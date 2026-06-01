"""Unit Gradient Field SDF library, numpy port.

Reference implementation provided by Gradient Control Laboratories.

Vectors are numpy arrays. Points typically have shape ``(..., D)`` where
``D`` is the spatial dimension (2 or 3); single-point ``(3,)`` and
batched ``(N, 3)`` (or any leading shape) use the same code via
broadcasting -- the toolpath hot path evaluates 200k+ samples per slice
this way.

Boolean operators take a ``list[np.ndarray]`` of per-point SDF values;
primitives take ``p`` of shape ``(..., D)`` and return shape ``(...,)``.
"""
from __future__ import annotations

from functools import reduce, partial
from itertools import combinations
from typing import Callable, Optional, Sequence, Union

import numpy as np


# ---------------------------------------------------------
# CONSTANTS (replace pyglm's pi(), two_pi(), root_two(), root_three())
# ---------------------------------------------------------

PI = float(np.pi)
TWO_PI = 2.0 * PI
SQRT2 = float(np.sqrt(2.0))
SQRT3 = float(np.sqrt(3.0))


# ---------------------------------------------------------
# UTILITY CONSTRUCTORS / CONVERSIONS
# ---------------------------------------------------------

VecLike = Union[float, Sequence[float], np.ndarray]


def vec2(*args) -> np.ndarray:
    """Construct a length-2 float64 array.

    ``vec2(s)`` broadcasts scalar to ``[s, s]``; ``vec2(x, y)`` sets
    components; ``vec2(seq)`` clips a sequence to the first two values.
    """
    if len(args) == 1:
        a = np.asarray(args[0], dtype=np.float64)
        if a.ndim == 0:
            return np.full(2, float(a))
        return a[..., :2].astype(np.float64, copy=False)
    if len(args) == 2:
        return np.array(args, dtype=np.float64)
    raise TypeError(f"vec2 takes 1 or 2 args, got {len(args)}")


def vec3(*args) -> np.ndarray:
    """Construct a length-3 float64 array.

    ``vec3(s)`` broadcasts scalar to ``[s, s, s]``; ``vec3(x, y, z)`` sets
    components; ``vec3(seq)`` clips a sequence to the first three values.
    """
    if len(args) == 1:
        a = np.asarray(args[0], dtype=np.float64)
        if a.ndim == 0:
            return np.full(3, float(a))
        return a[..., :3].astype(np.float64, copy=False)
    if len(args) == 3:
        return np.array(args, dtype=np.float64)
    raise TypeError(f"vec3 takes 1 or 3 args, got {len(args)}")


def ensure_vec_like(v: VecLike, template: np.ndarray) -> np.ndarray:
    """Coerce ``v`` to broadcast against ``template``'s spatial dim.

    Scalar ``v`` becomes ``(D,)`` with ``D = template.shape[-1]``;
    sequences are converted to ``np.ndarray`` as-is.
    """
    dim = int(template.shape[-1])
    a = np.asarray(v, dtype=np.float64)
    if a.ndim == 0:
        return np.full(dim, float(a))
    return a


def _zero_like_spatial(template: np.ndarray) -> np.ndarray:
    """Zero vector matching ``template``'s spatial dim."""
    return np.zeros(int(template.shape[-1]), dtype=np.float64)


# ---------------------------------------------------------
# MATH UTILITIES
# ---------------------------------------------------------

def length(v: np.ndarray) -> np.ndarray:
    """Euclidean length along the last axis."""
    return np.linalg.norm(v, axis=-1)


def dot(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Per-point dot product along the last axis (batched-friendly)."""
    return np.sum(np.asarray(a) * np.asarray(b), axis=-1)


def normalize(v: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    """Normalize along the last axis; zero vectors pass through unchanged."""
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return np.where(n > eps, v / np.maximum(n, eps), v)


def clamp(x, lo, hi):
    return np.clip(x, lo, hi)


def linear_map(value, in_min, in_max, out_min, out_max):
    """Map value from [in_min, in_max] to [out_min, out_max]."""
    slope = (out_max - out_min) / (in_max - in_min)
    return (value - in_min) * slope + out_min


def ramp(value, in_min, in_max, out_min, out_max):
    """Linearly map, clamped to the output bounds."""
    return np.clip(linear_map(value, in_min, in_max, out_min, out_max),
                   out_min, out_max)


def negate(values):
    """Negate a list of distance values (for De Morgan's Law)."""
    return [-v for v in values]


def two_body_field(a, b):
    """Cayley transform / two-body interpolant: (A - B) / (A + B)."""
    return (a - b) / (a + b)


def two_body_polar(a, b, angle):
    """Blend two fields by angular parameter."""
    return a * np.cos(angle) + b * np.sin(angle)


# ---------------------------------------------------------
# REDUCTIONS
# ---------------------------------------------------------

def product(v: np.ndarray) -> np.ndarray:
    """Product of components along the last axis."""
    return np.prod(v, axis=-1)


# ---------------------------------------------------------
# PERIODIC UTILITIES
# ---------------------------------------------------------

def triangle_wave_even(param, period):
    """Even triangle wave with given period, zero at origin."""
    half = 0.5 * period
    quarter = 0.25 * period
    t_mod = (param + half) % period
    return quarter - np.abs(t_mod - half)


def triangle_wave_even_positive(param, period):
    """Even triangle wave shifted to positive range [0, period/2]."""
    return triangle_wave_even(param, period) + 0.25 * period


def triangle_wave_odd(param, period):
    """Odd triangle wave with given period, zero at origin."""
    return triangle_wave_even(param - 0.5 * period, period)


def triangle_wave_odd_positive(param, period):
    """Odd triangle wave shifted to positive range [0, period/2]."""
    return triangle_wave_odd(param, period) + 0.25 * period


# ---------------------------------------------------------
# N-ARY BOOLEAN OPERATIONS (Core)
# ---------------------------------------------------------

def intersect_sharp(values, k: float = 0.0):
    """Sharp intersection (elementwise max of signed distances). k ignored."""
    return reduce(np.maximum, values)


def union_sharp(values, k: float = 0.0):
    """Sharp union (elementwise min of signed distances). k ignored."""
    return reduce(np.minimum, values)


def intersect_lp_norm(values, k: float, p: float):
    """
    N-ary intersection blend using generalized Lp norm.

    Args:
        values: List of per-point SDF arrays
        k: Blend radius (0 for sharp intersection)
        p: Norm parameter (p > 0)
           p < 1: Coves (concave)
           p = 1: Manhattan/taxicab
           p = 2: Euclidean (round)
           p > 2: Sharper, approaching max as p -> infinity

    Continuity: C^(p-1) (C0 for p=1, C1 for p=2, C-infty as p -> infinity).
    """
    k = max(0.0, k)
    if k == 0.0 or p == 0.0:
        return intersect_sharp(values)
    clamped = [np.maximum(v + k, 0.0) for v in values]
    lp_norm = sum(c ** p for c in clamped) ** (1.0 / p)
    return np.minimum(-k, intersect_sharp(values)) + lp_norm


def union_lp_norm(values, k: float, p: float):
    """N-ary union blend using generalized Lp norm (via De Morgan's Law)."""
    return -intersect_lp_norm(negate(values), k, p)


def intersect_round(values, k: float):
    """
    N-ary intersection with rounded fillets (L2 norm).

    Creates spherical fillets of radius k at intersections.
    Specialization of intersect_lp_norm at p=2 (avoids the ``** (1/p)``).
    """
    k = max(0.0, k)
    clamped = [np.maximum(v + k, 0.0) for v in values]
    lp_norm = np.sqrt(sum(c * c for c in clamped))
    return np.minimum(-k, intersect_sharp(values)) + lp_norm


def union_round(values, k: float):
    """N-ary union with rounded fillets (via De Morgan's Law)."""
    return -intersect_round(negate(values), k)


def intersect_exp(values, k: float):
    """
    N-ary exponential intersection blend (LogSumExp).

    C-infinity smooth blend; the factor of 2 makes setback comparable
    to the rounded blend at the same radius.
    """
    if k <= 0.0:
        return intersect_sharp(values)
    safe_k = max(k, 1e-6) / 2.0
    exp_values = [np.exp(v / safe_k) for v in values]
    return safe_k * np.log(sum(exp_values))


def union_exp(values, k: float):
    """N-ary exponential union blend (via De Morgan's Law)."""
    return -intersect_exp(negate(values), k)


def intersect_rvachev(values, k: float):
    """
    N-ary Rvachev R0-function intersection, gated to a transition band.

    Args:
        values: List of per-point SDF arrays
        k: Blend radius (length units). Outside the transition zone
           (sharp distance below -k), returns the sharp intersection.
           Within the band, smoothly transitions from sharp to pure R0
           via a cubic smoothstep.

    Theory:
        Pure R0 is parameter-free:
            R0(d1, d2, ..., dn) = sum(d) - sqrt(sum(d*d))
        This variant interpolates sharp <-> R0 via a smoothstep on
        (sharp + k) / k, so the field is sharp at d=-k, full R0 at d=0
        and beyond. C1 continuous at the gate.

        Length-controlled radius comes at the cost of being a hybrid
        rather than algebraically pure: R0's zero set differs from
        sharp's near multi-input corners, so the rendered boundary
        shifts by O(k) (similar to other smooth booleans).

    Reference: Rvachev, V.L. "Theory of R-functions" (1982)
    """
    sharp = intersect_sharp(values)
    k = max(0.0, k)
    if k == 0.0:
        return sharp
    sum_v = sum(values)
    sum_sq = sum(v * v for v in values)
    r0 = sum_v - np.sqrt(sum_sq)
    t = np.clip((sharp + k) / k, 0.0, 1.0)
    s = t * t * (3.0 - 2.0 * t)
    return np.where(sharp < -k, sharp, (1.0 - s) * sharp + s * r0)


def union_rvachev(values, k: float):
    """N-ary Rvachev R0-function union (via De Morgan's Law)."""
    return -intersect_rvachev(negate(values), k)


# ---------------------------------------------------------
# BOOLEAN STYLE OBJECTS & FACTORIES
# ---------------------------------------------------------

class Boolean:
    """
    N-ary boolean (CSG) operators for SDFs.

    Bundles an intersection function, a union function, and a blend
    radius. Union is derived via De Morgan's Law unless provided.
    """

    def __init__(self,
                 intersect_func: Callable,
                 radius: float = 0.0,
                 union_func: Optional[Callable] = None):
        self.radius = radius
        self.intersect = intersect_func
        if union_func is not None:
            self.union = union_func
        else:
            self.union = lambda values, k: -self.intersect(negate(values), k)

    def with_radius(self, new_radius: float) -> "Boolean":
        """Return a new Boolean with a different radius."""
        is_derived_union = "lambda" in str(self.union)
        union_func = None if is_derived_union else self.union
        return Boolean(self.intersect, new_radius, union_func)

    def __repr__(self) -> str:
        func = self.intersect
        if isinstance(func, partial):
            name = func.func.__name__
        else:
            name = getattr(func, "__name__", "unknown")
        return f"<Boolean R={self.radius:.2f} Type={name}>"


# --- Boolean factory functions ---

def boolean_sharp() -> Boolean:
    """Sharp boolean operations (standard CSG)."""
    return Boolean(intersect_sharp, 0.0, union_func=union_sharp)


def boolean_round(radius: float = 0.0) -> Boolean:
    """L2 rounded blending (spherical fillets)."""
    return Boolean(intersect_round, radius, union_func=union_round)


def boolean_exp(radius: float = 0.0) -> Boolean:
    """Exponential blending (C-infinity smooth)."""
    return Boolean(intersect_exp, radius, union_func=union_exp)


def boolean_lp(p: float, radius: float = 0.0) -> Boolean:
    """
    Generalized Lp-norm blending.

    Args:
        p: Norm parameter (p > 0)
           p < 1: Coves (concave blends)
           p = 1: Manhattan/taxicab distance
           p = 2: Euclidean (round) blending
           p > 2: Sharper blends approaching max as p -> infinity
        radius: Blend radius
    """
    if p <= 0.0:
        raise ValueError(f"Lp norm requires p > 0, got {p}")
    lp_intersect = partial(intersect_lp_norm, p=p)
    lp_union = partial(union_lp_norm, p=p)
    return Boolean(lp_intersect, radius, union_func=lp_union)


def boolean_rvachev(radius: float = 0.0) -> Boolean:
    """
    Rvachev R0-blending gated to a transition band of width ``radius``.

    Within ``radius`` of the sharp boundary, the field smoothly
    interpolates from sharp toward pure R0 via a cubic smoothstep
    (C1 at the gate). Outside the band, behaves like sharp.
    See ``intersect_rvachev`` for the boundary-shift caveat.
    """
    return Boolean(intersect_rvachev, radius, union_func=union_rvachev)


# ---------------------------------------------------------
# N-ARY BOOLEAN OPERATIONS (Composite)
# ---------------------------------------------------------

def intersect_chamfer(values, k: float,
                      boolean: Optional[Boolean] = None,
                      handle_vertex: bool = False):
    """
    N-ary chamfer blend using Unit Gradient Field theory.

    Args:
        values: List of per-point SDF arrays
        k: Chamfer radius
        boolean: Boolean operator for tertiary blend (default: sharp via
                 round-with-radius-0)
        handle_vertex: Include vertex fields (N-choose-3)

    Theory:
        For N primitives with distances d_i, derive three field families:
        - F1 = max(d_i + k)                  : Face regions (N choose 1)
        - F2 = max((d_i + d_j + k)/sqrt(2))  : Edge regions (N choose 2)
        - F3 = max((d_i + d_j + d_k + k)/sqrt(3))  : Vertex regions (N choose 3)

        Final field is max(F1, F2, F3), producing exact 45 deg bevels.
    """
    boolean = boolean if boolean is not None else boolean_round(0.0)
    n = len(values)
    if n == 0:
        return intersect_sharp(values)

    derived_fields = [intersect_sharp(values)]  # face field

    if n >= 2:
        edge_fields = [(v1 + v2 + k) / SQRT2
                       for v1, v2 in combinations(values, 2)]
        derived_fields.append(intersect_sharp(edge_fields))

    if handle_vertex and n >= 3:
        vertex_fields = [(v1 + v2 + v3 + k) / SQRT3
                         for v1, v2, v3 in combinations(values, 3)]
        derived_fields.append(intersect_sharp(vertex_fields))

    return boolean.intersect(derived_fields, boolean.radius)


def union_chamfer(values, k: float,
                  boolean: Optional[Boolean] = None,
                  handle_vertex: bool = True):
    """N-ary chamfer union (via De Morgan's Law)."""
    return -intersect_chamfer(negate(values), k, boolean, handle_vertex)


def difference(target, tools,
               difference_boolean: Optional[Boolean] = None,
               tool_union_boolean: Optional[Boolean] = None):
    """
    Boolean difference: target - union(tools).

    Args:
        target: Per-point SDF of the target body
        tools: List of per-point SDFs for tool bodies to subtract
        difference_boolean: Boolean operator for the final difference
        tool_union_boolean: Boolean operator for unioning the tools

    Theory:
        A - (B union C union ...) = A intersect not-B intersect not-C ...
    """
    difference_boolean = (difference_boolean if difference_boolean is not None
                          else boolean_round(0.0))
    tool_union_boolean = (tool_union_boolean if tool_union_boolean is not None
                          else boolean_round(0.0))
    tool_union = tool_union_boolean.union(tools, tool_union_boolean.radius)
    return difference_boolean.intersect([target, -tool_union],
                                        difference_boolean.radius)


# --- Composite Boolean Factory ---

def boolean_chamfer(radius: float = 0.0,
                    boolean: Optional[Boolean] = None,
                    handle_vertex: bool = True) -> Boolean:
    """
    Geometrically-correct chamfer blending using Unit Gradient Field theory.

    Args:
        radius: Chamfer radius
        boolean: Boolean operator for tertiary blend (default: sharp)
        handle_vertex: Include vertex fields (N-choose-3)
    """
    boolean = boolean if boolean is not None else boolean_sharp()
    tertiary_radius = max(0.0, boolean.radius - radius)
    tertiary_boolean = boolean.with_radius(tertiary_radius)

    chamfer_intersect = partial(intersect_chamfer,
                                boolean=tertiary_boolean,
                                handle_vertex=handle_vertex)
    chamfer_union = partial(union_chamfer,
                            boolean=tertiary_boolean,
                            handle_vertex=handle_vertex)
    return Boolean(chamfer_intersect, radius, union_func=chamfer_union)


# ---------------------------------------------------------
# PRIMITIVE DISTANCE FUNCTIONS
# ---------------------------------------------------------

def box_centered(p, size, boolean: Optional[Boolean] = None,
                 center: Optional[np.ndarray] = None):
    """
    Signed distance to axis-aligned box.

    Args:
        p: Query point(s), shape ``(..., D)``
        size: Box dimensions (scalar or shape ``(D,)``)
        boolean: Boolean operator for slab intersection (default: round R=0)
        center: Box center (default: origin)

    Theory:
        A box is the intersection of 2N axis-aligned half-spaces.
        For each axis i: |p_i - c_i| - s_i/2
    """
    p = np.asarray(p, dtype=np.float64)
    boolean = boolean if boolean is not None else boolean_round(0.0)
    size = ensure_vec_like(size, p)
    if center is None:
        center = _zero_like_spatial(p)
    else:
        center = np.asarray(center, dtype=np.float64)

    slab_distances = np.abs(p - center) - size * 0.5
    slabs = [slab_distances[..., i] for i in range(p.shape[-1])]
    return boolean.intersect(slabs, boolean.radius)


def circle(p, center, radius: float):
    """Signed distance to 2D circle (or D-sphere centered at ``center``)."""
    return np.linalg.norm(np.asarray(p) - np.asarray(center), axis=-1) - radius


def sphere(p, center, radius: float):
    """Signed distance to 3D sphere."""
    return np.linalg.norm(np.asarray(p) - np.asarray(center), axis=-1) - radius


def plane(p, origin, normal):
    """Signed distance to infinite plane (positive on the normal side)."""
    p = np.asarray(p, dtype=np.float64)
    origin = np.asarray(origin, dtype=np.float64)
    n = np.asarray(normal, dtype=np.float64)
    n_norm = np.linalg.norm(n)
    n_unit = n / n_norm if n_norm > 1e-12 else n
    return np.sum((p - origin) * n_unit, axis=-1)


def line_segment(p, endpoint_a, endpoint_b):
    """Distance to line segment from endpoint_a to endpoint_b."""
    p = np.asarray(p, dtype=np.float64)
    a = np.asarray(endpoint_a, dtype=np.float64)
    b = np.asarray(endpoint_b, dtype=np.float64)
    seg = b - a
    seg_sq = np.dot(seg, seg)
    if seg_sq < 1e-20:
        return np.linalg.norm(p - a, axis=-1)
    to_p = p - a
    t = np.clip(np.sum(to_p * seg, axis=-1) / seg_sq, 0.0, 1.0)
    # Broadcast t along the spatial axis
    proj = a + t[..., None] * seg
    return np.linalg.norm(p - proj, axis=-1)


def torus(p, major_radius: float, minor_radius: float):
    """Signed distance to torus in XY plane centered at origin."""
    p = np.asarray(p, dtype=np.float64)
    radial = np.linalg.norm(p[..., :2], axis=-1) - major_radius
    return np.sqrt(radial * radial + p[..., 2] ** 2) - minor_radius


def axis(p, origin, direction):
    """
    Distance to infinite axis (perpendicular distance).

    Dual of plane -- measures distance perpendicular to the axis.
    """
    p = np.asarray(p, dtype=np.float64)
    origin = np.asarray(origin, dtype=np.float64)
    direction = np.asarray(direction, dtype=np.float64)
    dir_len = np.linalg.norm(direction)
    if dir_len == 0.0:
        return np.linalg.norm(p - origin, axis=-1)
    dir_unit = direction / dir_len
    to_p = p - origin
    axial = np.sum(to_p * dir_unit, axis=-1, keepdims=True)
    perp = to_p - axial * dir_unit
    return np.linalg.norm(perp, axis=-1)


def cylinder(p, origin, direction, radius: float):
    """Signed distance to infinite cylinder."""
    return axis(p, origin, direction) - radius


def cylinder_capped(p, endpoint_a, endpoint_b, radius: float,
                    boolean: Optional[Boolean] = None):
    """
    Signed distance to capped cylinder (intersection of infinite cylinder
    with two opposing half-spaces). ``boolean`` controls cap blending.
    """
    boolean = boolean if boolean is not None else boolean_round(0.0)
    a = np.asarray(endpoint_a, dtype=np.float64)
    b = np.asarray(endpoint_b, dtype=np.float64)
    axis_vec = b - a

    dist_to_surface = axis(p, a, axis_vec) - radius
    dist_to_cap_a = -plane(p, a, axis_vec)
    dist_to_cap_b = plane(p, b, axis_vec)
    return boolean.intersect(
        [dist_to_surface, dist_to_cap_a, dist_to_cap_b], boolean.radius)


def capsule(p, endpoint_a, endpoint_b, radius: float):
    """Signed distance to capsule (cylinder with hemispherical caps)."""
    return line_segment(p, endpoint_a, endpoint_b) - radius


def cone(p, apex, direction, half_angle: float):
    """
    Signed distance to unbounded cone.

    Args:
        p: Query point(s), shape ``(..., 3)``
        apex: Cone apex position
        direction: Cone axis direction
        half_angle: Angle from axis to surface (radians)
    """
    p = np.asarray(p, dtype=np.float64)
    apex = np.asarray(apex, dtype=np.float64)
    direction = np.asarray(direction, dtype=np.float64)
    dir_len = np.linalg.norm(direction)
    if dir_len == 0.0:
        return np.linalg.norm(p - apex, axis=-1)
    dir_unit = direction / dir_len
    to_p = p - apex
    axial = np.sum(to_p * dir_unit, axis=-1)
    perp = np.linalg.norm(to_p - axial[..., None] * dir_unit, axis=-1)
    return perp - axial * np.tan(half_angle)


def cone_capped(p, endpoint_a, endpoint_b,
                radius_a: float, radius_b: float,
                boolean: Optional[Boolean] = None):
    """Signed distance to capped cone (frustum). ``boolean`` controls caps."""
    boolean = boolean if boolean is not None else boolean_round(0.0)
    a = np.asarray(endpoint_a, dtype=np.float64)
    b = np.asarray(endpoint_b, dtype=np.float64)
    axis_vec = b - a
    axis_length = float(np.linalg.norm(axis_vec))
    if axis_length == 0.0:
        return sphere(p, a, radius_a)

    half_angle = np.arctan2(abs(radius_b - radius_a), axis_length)
    if radius_a < radius_b:
        cone_dist = cone(p, a, axis_vec, half_angle) - radius_a
    else:
        cone_dist = cone(p, b, -axis_vec, half_angle) - radius_b

    dist_to_cap_a = -plane(p, a, axis_vec)
    dist_to_cap_b = plane(p, b, axis_vec)
    return boolean.intersect(
        [cone_dist, dist_to_cap_a, dist_to_cap_b], boolean.radius)


def cone_capsule(p, endpoint_a, endpoint_b,
                 radius_a: float, radius_b: float):
    """
    Signed distance to cone with spherical caps (tangent-continuous).

    The conical surface is tangent to both spheres at the endpoints.
    """
    p = np.asarray(p, dtype=np.float64)
    a = np.asarray(endpoint_a, dtype=np.float64)
    b = np.asarray(endpoint_b, dtype=np.float64)
    axis_vec = b - a
    axis_length = float(np.linalg.norm(axis_vec))
    if axis_length == 0.0:
        return sphere(p, a, radius_a)

    to_p = p - a
    t = np.clip(np.sum(to_p * axis_vec, axis=-1)
                / (axis_length * axis_length), 0.0, 1.0)
    interp_r = radius_a + t * (radius_b - radius_a)
    closest = a + t[..., None] * axis_vec
    return np.linalg.norm(p - closest, axis=-1) - interp_r


# ---------------------------------------------------------
# DOMAIN WARPING & REPETITION
# ---------------------------------------------------------

def shell(distance, thickness: float, bias: float = 0.0):
    """
    Shell/onion operation: |d + bias*t/2| - t/2

    Args:
        distance: Signed distance value(s)
        thickness: Wall thickness
        bias: Offset bias (shifts shell inward/outward)
    """
    half = thickness * 0.5
    return np.abs(distance + bias * half) - half


def rotate_axis(p, origin, direction, angle: float):
    """
    Rotate point(s) around an arbitrary axis using Rodrigues' formula.

    Args:
        p: Point(s) to rotate, shape ``(..., 3)``
        origin: Point on the rotation axis
        direction: Axis direction vector
        angle: Rotation angle (radians, right-hand rule)
    """
    p = np.asarray(p, dtype=np.float64)
    origin = np.asarray(origin, dtype=np.float64)
    k = np.asarray(direction, dtype=np.float64)
    k = k / np.linalg.norm(k)
    p_local = p - origin

    c, s = np.cos(angle), np.sin(angle)
    k_cross_p = np.cross(k, p_local)
    k_dot_p = np.sum(k * p_local, axis=-1, keepdims=True)
    rotated = p_local * c + k_cross_p * s + k * k_dot_p * (1.0 - c)
    return rotated + origin


def repeat_centered(p, period):
    """Repeat point ``p`` within a centered cell of size ``period``."""
    p = np.asarray(p, dtype=np.float64)
    period = np.asarray(period, dtype=np.float64)
    return (p + period * 0.5) % period - period * 0.5


# ---------------------------------------------------------
# COORDINATE REMAPPING
# ---------------------------------------------------------

def remap_cylindrical(p, circumference: float):
    """
    Wrap a Cartesian field around a cylinder aligned with the z-axis.

    Args:
        p: Query point(s) in world space, shape ``(..., 3)``
        circumference: Cylinder circumference (maps to y-range of pattern)

    Returns:
        Remapped point(s) for evaluating a flat pattern:
            x' = radial distance from z-axis
            y' = angle around z-axis, scaled to circumference
            z' = original z (height along cylinder)
    """
    p = np.asarray(p, dtype=np.float64)
    radial = np.sqrt(p[..., 0] ** 2 + p[..., 1] ** 2)
    theta = np.arctan2(p[..., 1], p[..., 0])
    theta_scaled = theta * (circumference / TWO_PI)
    pz = p[..., 2] if p.shape[-1] >= 3 else np.zeros_like(radial)
    return np.stack([radial, theta_scaled, pz], axis=-1)


# ---------------------------------------------------------
# HONEYCOMB / LATTICE PATTERNS
# ---------------------------------------------------------

def cubic_grid(p, size, boolean: Optional[Boolean] = None):
    """Signed distance to 3D cubic grid (orthogonal planes)."""
    p = np.asarray(p, dtype=np.float64)
    boolean = boolean if boolean is not None else boolean_round(0.0)
    size = ensure_vec_like(size, p)
    plane_distances = triangle_wave_even_positive(p, size)
    planes = [plane_distances[..., i] for i in range(p.shape[-1])]
    return boolean.union(planes, boolean.radius)


def square_honeycomb(p, size, boolean: Optional[Boolean] = None):
    """Signed distance to square honeycomb lattice (XY plane, z ignored)."""
    p = np.asarray(p, dtype=np.float64)
    p_xy = p[..., :2]
    size = vec2(size) if np.ndim(size) == 0 else np.asarray(size)[:2]
    return cubic_grid(p_xy, size, boolean)


def square_honeycomb_reinforced(p, size,
                                rotation: float = 0.25,
                                rotation2: Optional[float] = None,
                                boolean: Optional[Boolean] = None):
    """
    Square honeycomb with diagonal reinforcement beams.

    Args:
        p: Query point(s), XY plane (z ignored)
        size: Cell dimensions (scalar or vec2)
        rotation: First diagonal angle as fraction of pi (default 0.25 = 45 deg)
        rotation2: Optional second diagonal angle (creates an X pattern)
        boolean: Boolean operator for beam union
    """
    boolean = boolean if boolean is not None else boolean_round(0.0)
    p = np.asarray(p, dtype=np.float64)
    p_xy = p[..., :2]
    size = vec2(size) if np.ndim(size) == 0 else np.asarray(size)[:2]

    grid_x = triangle_wave_even_positive(p_xy[..., 0], size[0])
    grid_y = triangle_wave_even_positive(p_xy[..., 1], size[1])
    square_grid = boolean.union([grid_x, grid_y], boolean.radius)

    p_rep = repeat_centered(p_xy, size)
    angle = PI * rotation
    normal = vec2(np.cos(angle), np.sin(angle))
    diagonal = np.abs(plane(p_rep, vec2(0.0, 0.0), normal))

    if rotation2 is not None:
        angle2 = PI * rotation2
        normal2 = vec2(np.cos(angle2), np.sin(angle2))
        diagonal2 = np.abs(plane(p_rep, vec2(0.0, 0.0), normal2))
        diagonal = boolean.union([diagonal, diagonal2], boolean.radius)

    return boolean.union([square_grid, diagonal], boolean.radius)


def square_diagonal_honeycomb(p, size, boolean: Optional[Boolean] = None):
    """
    Signed distance to diagonal honeycomb (diamond lattice).

    Two diagonal planes at angles determined by the size ratio;
    period is sum(size) in the diagonal direction.
    """
    boolean = boolean if boolean is not None else boolean_round(0.0)
    p = np.asarray(p, dtype=np.float64)
    p_xy = p[..., :2]
    size = vec2(size) if np.ndim(size) == 0 else np.asarray(size)[:2]

    period = vec2(float(size[0] + size[1]), float(size[0] + size[1]))
    p_rep = repeat_centered(p_xy, period)

    normal_pos = vec2(size[1], size[0])
    normal_neg = vec2(size[1], -size[0])
    dist_pos = np.abs(plane(p_rep, vec2(0.0, 0.0), normal_pos))
    dist_neg = np.abs(plane(p_rep, vec2(0.0, 0.0), normal_neg))

    return boolean.union([dist_pos, dist_neg], boolean.radius)


def octet_honeycomb(p, size, boolean: Optional[Boolean] = None):
    """
    Octet honeycomb: highly connected square grid with diagonal members.

    Based on work by Martha Baldwin, CMU. Combines three beam systems
    (square + phase-shifted plane grid + rotated diagonal grid) for a
    stretch-dominated lattice.
    """
    boolean = boolean if boolean is not None else boolean_round(0.0)
    p = np.asarray(p, dtype=np.float64)
    p_xy = p[..., :2]
    size = vec2(size) if np.ndim(size) == 0 else np.asarray(size)[:2]

    square = square_honeycomb(p, size, boolean)

    plane_x = triangle_wave_odd_positive(p_xy[..., 0], size[0])
    plane_y = triangle_wave_odd_positive(p_xy[..., 1], size[1])
    plane_grid = boolean.union([plane_x, plane_y], boolean.radius)

    diagonal_period = float(np.linalg.norm(size)) * 0.5
    rotated_u = (p_xy[..., 0] + p_xy[..., 1]) / SQRT2
    rotated_v = (p_xy[..., 0] - p_xy[..., 1]) / SQRT2
    plane_u = triangle_wave_odd_positive(rotated_u, diagonal_period)
    plane_v = triangle_wave_odd_positive(rotated_v, diagonal_period)
    diagonal_grid = boolean.union([plane_u, plane_v], boolean.radius)

    combined = boolean.union([square, plane_grid], boolean.radius)
    return boolean.union([combined, diagonal_grid], boolean.radius)


def hexagonal_honeycomb(p, size, setback: float = 1.0 / 3.0,
                         boolean: Optional[Boolean] = None):
    """
    Signed distance to hexagonal honeycomb lattice.

    Creates a Y-shaped star at each cell center, tiled via reflection.
    Scalar ``size`` becomes ``[size, size*sqrt(3)]``.
    """
    boolean = boolean if boolean is not None else boolean_round(0.0)
    p = np.asarray(p, dtype=np.float64)
    p_xy = p[..., :2]
    if np.ndim(size) == 0:
        size_v = vec2(float(size), float(size) * SQRT3)
    else:
        size_v = np.asarray(size)[:2].astype(np.float64)

    half = size_v * 0.5
    quarter = size_v * 0.25

    star_center = vec2(0.0, (1.0 - setback) * half[1])
    transition = vec2(half[0], setback * half[1])

    p_folded = np.abs(repeat_centered(p_xy, size_v))

    def star_pattern(point):
        line_v = line_segment(point, star_center, vec2(0.0, size_v[1]))
        line_r = line_segment(point, star_center, transition)
        line_l = line_segment(point, star_center,
                              vec2(-transition[0], transition[1]))
        return boolean.union([line_v, line_r, line_l], boolean.radius)

    p_reflected = np.stack([p_folded[..., 0] - half[0],
                            half[1] - p_folded[..., 1]], axis=-1)
    result_a = star_pattern(p_folded)
    result_b = star_pattern(p_reflected)
    mask = p_folded[..., 0] < quarter[0]
    return np.where(mask, result_a, result_b)


def triangular_honeycomb(p, size, boolean: Optional[Boolean] = None):
    """
    Signed distance to triangular honeycomb lattice.

    Three infinite planes meeting at 60 deg angles, tiled via reflection.
    Scalar ``size`` becomes ``[size, size*sqrt(3)]``.
    """
    boolean = boolean if boolean is not None else boolean_round(0.0)
    p = np.asarray(p, dtype=np.float64)
    p_xy = p[..., :2]
    if np.ndim(size) == 0:
        size_v = vec2(float(size), float(size) * SQRT3)
    else:
        size_v = np.asarray(size)[:2].astype(np.float64)

    half = size_v * 0.5
    quarter = size_v * 0.25

    p_folded = np.abs(repeat_centered(p_xy, size_v))

    def star_pattern(point):
        normal_h = vec2(0.0, 1.0)
        normal_p60 = vec2(size_v[1], size_v[0])
        normal_n60 = vec2(size_v[1], -size_v[0])
        dist_h = np.abs(dot(point, normalize(normal_h)))
        dist_p60 = np.abs(dot(point, normalize(normal_p60)))
        dist_n60 = np.abs(dot(point, normalize(normal_n60)))
        return boolean.union([dist_h, dist_p60, dist_n60], boolean.radius)

    result_a = star_pattern(p_folded)
    result_b = star_pattern(p_folded - half)
    mask = p_folded[..., 1] < quarter[1]
    return np.where(mask, result_a, result_b)


# ---------------------------------------------------------
# TPMS FUNCTIONS (Triply Periodic Minimal Surfaces)
# ---------------------------------------------------------

def _tpms_prep(p, period, drop):
    """Coerce p / period / drop for TPMS evaluation.

    Returns (p (..., 3), period (3,), drop (3,)).
    """
    p = np.asarray(p, dtype=np.float64)
    if p.shape[-1] != 3:
        p = vec3(p)
    period = ensure_vec_like(period, p) if np.ndim(period) > 0 else np.full(3, float(period))
    if drop is None:
        drop = np.ones(3, dtype=np.float64)
    else:
        drop = ensure_vec_like(drop, p) if np.ndim(drop) > 0 else np.full(3, float(drop))
    return p, period, drop


def tpms_gyroid(p, period, drop=None):
    """
    Gyroid TPMS: sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x) = 0

    Args:
        p: Query point(s), shape ``(..., 3)``
        period: Periodicity (scalar or vec3)
        drop: Anisotropy weights (scalar or vec3, default isotropic)

    Returns:
        Per-point scalar field, normalized by ``sum(period) / 18``.
    """
    p, period, drop = _tpms_prep(p, period, drop)
    frequency = TWO_PI / period
    xyz = p * frequency
    yzx = np.roll(xyz, -1, axis=-1)
    field = np.sum(drop * np.sin(xyz) * np.cos(yzx), axis=-1)
    return field * np.sum(period) / 18.0


def tpms_schwarz(p, period, drop=None, gyroid_blend: float = 0.0):
    """
    Schwarz P TPMS interpolated with Gyroid.

    Args:
        gyroid_blend: 0 = Schwarz P, 1 = Gyroid.
    """
    p, period, drop = _tpms_prep(p, period, drop)
    frequency = TWO_PI / period
    xyz = p * frequency
    yzx = np.roll(xyz, -1, axis=-1)

    sin_xyz = np.sin(xyz)
    cos_yzx = np.cos(yzx)

    blend_factor = 1.0 - gyroid_blend
    mix = -blend_factor + sin_xyz * gyroid_blend
    field = np.sum(drop * cos_yzx * mix, axis=-1)
    return field * np.sum(period) / 36.0


def tpms_diamond(p, period, drop=None, gyroid_blend: float = 0.0):
    """
    Diamond TPMS interpolated with Gyroid.

    Args:
        gyroid_blend: 0 = Diamond, 1 = Gyroid.
    """
    p, period, drop = _tpms_prep(p, period, drop)
    range_val = 2.0 * SQRT2
    periodicity = 2.0

    frequency = TWO_PI / period
    xyz = p * frequency
    yzx = np.roll(xyz, -1, axis=-1)

    sin_xyz = np.sin(xyz)
    cos_yzx = np.cos(yzx)
    cos_zxy = np.roll(cos_yzx, -1, axis=-1)

    blend_factor = 1.0 - gyroid_blend
    term1 = blend_factor * product(sin_xyz)
    mix = cos_zxy * blend_factor + gyroid_blend
    term2 = np.sum(drop * sin_xyz * cos_yzx * mix, axis=-1)
    field = term1 + term2
    return field * np.sum(period) / (6.0 * range_val * periodicity)


def tpms_lidinoid(p, period, drop=None, gyroid_blend: float = 0.0):
    """
    Lidinoid (Schoen's surface) interpolated with Gyroid.

    Args:
        gyroid_blend: 0 = Lidinoid, 1 = Gyroid.
    """
    p, period, drop = _tpms_prep(p, period, drop)
    frequency = TWO_PI / period
    xyz = p * frequency
    yzx = np.roll(xyz, -1, axis=-1)
    zxy = np.roll(xyz, -2, axis=-1)

    sin_zxy = np.sin(zxy)
    cos_yzx = np.cos(yzx)
    sin2_xyz = np.sin(2.0 * xyz)
    cos2_xyz = np.cos(2.0 * xyz)
    cos2_yzx = np.roll(cos2_xyz, -1, axis=-1)

    blend_factor = 1.0 - gyroid_blend
    mix = sin2_xyz * blend_factor + gyroid_blend
    term1 = np.sum(drop * sin_zxy * cos_yzx * mix, axis=-1)
    term2 = blend_factor * np.sum(cos2_xyz * cos2_yzx, axis=-1)
    field = term1 - term2
    return field * np.sum(period) / 72.0


def tpms_neovius(p, period, drop=None, schwarz_blend: float = 0.0):
    """
    Neovius TPMS interpolated with Schwarz.

    Args:
        schwarz_blend: 0 = Neovius, 1 = Schwarz.
    """
    p, period, drop = _tpms_prep(p, period, drop)
    range_val = 26.0 / 3.0

    frequency = TWO_PI / period
    xyz = p * frequency
    cos_drop = np.cos(xyz) * drop

    term1 = -np.sum(cos_drop, axis=-1)
    term2 = (1.0 - schwarz_blend) * (4.0 / 3.0) * product(cos_drop)
    field = term1 - term2
    return field * np.sum(period) / (6.0 * range_val)


def tpms_split_p(p, period,
                 lidinoid_blend: float,
                 gyroid_octave: float,
                 schwarz_octave: float):
    """
    Split-P TPMS with multiple octave parameters.
    """
    p, period, _ = _tpms_prep(p, period, None)
    range_val = 6.0

    frequency = TWO_PI / period
    xyz = p * frequency
    yzx = np.roll(xyz, -1, axis=-1)
    zxy = np.roll(xyz, -2, axis=-1)

    sin_zxy = np.sin(zxy)
    cos_yzx = np.cos(yzx)
    sin_2xyz = np.sin(2.0 * xyz)
    cos_2xyz = np.cos(2.0 * xyz)

    term1 = -lidinoid_blend * np.sum(sin_2xyz * cos_yzx * sin_zxy, axis=-1)
    term2 = gyroid_octave * np.sum(sin_2xyz * cos_2xyz, axis=-1)
    term3 = schwarz_octave * np.sum(cos_2xyz, axis=-1)
    field = term1 + term2 + term3
    return field * np.sum(period) / (6.0 * range_val)


def tpms_iwp(p, period, drop=None):
    """I-WP (Schoen's I-WP) TPMS."""
    p, period, drop = _tpms_prep(p, period, drop)
    range_val = 8.0

    frequency = TWO_PI / period
    xyz = p * frequency
    yzx = np.roll(xyz, -1, axis=-1)
    cos_xyz = np.cos(xyz)
    cos_yzx = np.cos(yzx)
    cos_2xyz = np.cos(2.0 * xyz)

    term1 = 2.0 * np.sum(drop * cos_xyz * cos_yzx, axis=-1)
    term2 = np.sum(cos_2xyz, axis=-1)
    field = term1 - term2
    return field * np.sum(period) / (6.0 * range_val)
