export type CameraIntrinsics = {
  fx: number
  fy: number
  cx: number
  cy: number
}

export type CostVolumeMeta = {
  shape: [number, number, number]   // [h, w, nz]
  z_min: number
  z_max: number
  x_extent: number
}

export type SceneMeta = {
  name: string
  width: number
  height: number
  num_pairs: number
  radius: number
  intrinsics: CameraIntrinsics
  camera_positions: [number, number, number][]
  light_positions: [number, number, number][]
  depth_shape: [number, number]
  normal_shape: [number, number, number]
  has_depth_fc?: boolean
  cost_volume: CostVolumeMeta | null
  object_pose?: { location: number[]; rotation_euler: number[] }
}

export type LoadedScene = {
  meta: SceneMeta
  baseUrl: string         // e.g. "/data/suzanne/"
}
