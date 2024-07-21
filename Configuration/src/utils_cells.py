import os
# import matplotlib.pyplot as plt
import numpy as np
import scipy.stats
# from plotly.graph_objs import Mesh3d
# import plotly.graph_objects as go
import json
from scipy.spatial.transform import Rotation



def get_extremum_point_of_ellipsoid(ellipsoid, r):

    p = np.array(ellipsoid["position"])
    S = np.array(ellipsoid["shape"]).reshape((3,3))
    r = np.array(r)

    numerator = np.dot(S.T, r)
    denominator = np.linalg.norm(np.dot(S.T, r))

    e = p + np.dot(S, numerator / denominator)

    return e



def check_if_point_is_inside_voxel(point, voxel):

    voxel_xmin, voxel_xmax, voxel_ymin, voxel_ymax, voxel_zmin, voxel_zmax = voxel

    check_x = (point[0] > voxel_xmin) * (point[0] < voxel_xmax)
    check_y = (point[1] > voxel_ymin) * (point[1] < voxel_ymax)
    check_z = (point[2] > voxel_zmin) * (point[2] < voxel_zmax)

    check_net = check_x * check_y * check_z

    return check_net



def are_ellipsoids_separated(ellipsoid_a, ellipsoid_b, debug=False):

    S_a = np.array(ellipsoid_a["shape"]).reshape((3, 3))
    p_a = np.array(ellipsoid_a["position"])

    S_b = np.array(ellipsoid_b["shape"]).reshape((3, 3))
    p_b = np.array(ellipsoid_b["position"])

    #### minimal test
    rs = np.array([p_b - p_a])

    #### more thorough test
    #rs = generate_points_on_ellipsoid_surface(ellipsoid_a)

    for r in rs:
        dot_a = np.dot(S_a.T, r)
        x_a = np.dot(S_a, dot_a / np.linalg.norm(dot_a))
        e_a = x_a + p_a

        dot_b = np.dot(S_b.T, -r)
        x_b = np.dot(S_b, dot_b / np.linalg.norm(dot_b))
        e_b = x_b + p_b

        o = np.dot(r.T, e_a - e_b)

        separated = o < 1

        if separated:
            break

    if debug:
        return e_a, e_b, rs, p_a, p_b, o, separated
    else:
        return separated



def check_if_ellipsoid_extends_the_voxel(ellipsoid, voxel):

    """
    Went for the close-enough-solution: Check if the extrumum points of the three axes are outside the voxel.
    """

    # get voxel boundaries
    voxel_xmin, voxel_xmax, voxel_ymin, voxel_ymax, voxel_zmin, voxel_zmax = voxel

    # get eigen-vectors of shape
    S = np.array(ellipsoid["shape"]).reshape((3,3))
    eig_vals, eig_vecs = np.linalg.eig(S)

    # iterate through each eigen vector, and each direction of that eigen vector
    # to check if it"s inside the voxel
    inside = True

    for eig_vec in eig_vecs:
        # along positive direction
        e_plus = get_extremum_point_of_ellipsoid(ellipsoid, eig_vec)
        # along negative direction
        e_minus = get_extremum_point_of_ellipsoid(ellipsoid, -eig_vec)

        # check if those points are inside the voxel
        inside_plus = check_if_point_is_inside_voxel(e_plus, voxel)
        inside_minus = check_if_point_is_inside_voxel(e_minus, voxel)

        # update the bool
        inside *= inside_plus * inside_minus

    return inside



def generate_points_on_ellipsoid_surface(ellipsoid, flatten=True, res_1=50j, res_2=20j):

    """
    Not uniformly distributed, but good enough for now.

    For more uniformly distributed points, check Ex. 5 [here](https://github.com/maxkapur/param_tools/blob/master/examples.ipynb).
    """

    u, v = np.mgrid[-np.pi:np.pi:res_1, -np.pi/2:np.pi/2:res_2]

    q = [np.cos(u) * np.cos(v),
         np.sin(v),
         np.sin(u) * np.cos(v)]

    S = np.array(ellipsoid["shape"]).reshape((3, 3))
    p = np.array(ellipsoid["position"])

    x = S[0, 0] * q[0] + S[0, 1] * q[1] + S[0, 2] * q[2] + p[0]
    y = S[1, 0] * q[0] + S[1, 1] * q[1] + S[1, 2] * q[2] + p[1]
    z = S[2, 0] * q[0] + S[2, 1] * q[1] + S[2, 2] * q[2] + p[2]

    if flatten:
        return np.array([x.flatten(), y.flatten(), z.flatten()]).T
    else:
        return np.array([x, y, z]).T




def add_cells_to_config(path_config, CVF_des, l1_mean, l1_std, l2_mean, l2_std,
                        rotation_lim, l3_mean=None, l3_std=None, keep_existing=False):

    # load config
    with open(path_config, "rb") as f:
        config = json.load(f)

    print('config: ', config)

    voxel_xlength, voxel_ylength, voxel_zlength = config["voxelSize"]

    voxel_xmin, voxel_xmax = -voxel_xlength/2+config["border"], voxel_xlength/2-config["border"]
    voxel_ymin, voxel_ymax = -voxel_ylength/2+config["border"], voxel_ylength/2-config["border"]
    voxel_zmin, voxel_zmax = -voxel_zlength/2+config["border"], voxel_zlength/2-config["border"]

    voxel = [voxel_xmin, voxel_xmax, voxel_ymin, voxel_ymax, voxel_zmin, voxel_zmax]

    voxel_volume = (voxel_xlength - 2*config["border"]) * \
                   (voxel_ylength - 2*config["border"]) * \
                   (voxel_zlength - 2*config["border"])

    CV_des = CVF_des * voxel_volume

    #### initialize stuff
    CV_current = 0.0

    if keep_existing == False:
        config["cells"] =  []
    elif keep_existing == True:
        pass

    while CV_current <= CV_des:

        #### GENERATE CELL SHAPE
        l1 = np.random.normal(l1_mean, l1_std, 1)
        l2 = np.random.normal(l2_mean, l2_std, 1)
        if l3_mean != None:
            l3 = np.random.normal(l3_mean, l3_std, 1)
        else:
            l3 = l2

        shape = np.zeros((3,3))
        shape[0, 0] = l3
        shape[1, 1] = l2
        shape[2, 2] = l1

        #### ROTATE CELL
        # r = Rotation.from_rotvec([0, 0, 0]) # no rotation
        # r = Rotation.from_rotvec([np.deg2rad(90), 0, 0]) # 90 deg around x
        # r = Rotation.from_rotvec([0, np.deg2rad(90), 0]) # 90 deg around y
        # r = Rotation.from_rotvec([0, 0, np.deg2rad(90)]) # 90 deg around z

        r = Rotation.from_rotvec([np.deg2rad(0),
                                  np.deg2rad(np.random.uniform(-rotation_lim, rotation_lim)),
                                  np.deg2rad(np.random.uniform(0, 360))]) #

        shape = np.dot(np.dot(r.as_matrix().T, shape), r.as_matrix())

        #### GENERATE CELL POSITION
        position_x = np.random.uniform(voxel_xmin, voxel_xmax)
        position_y = np.random.uniform(voxel_ymin, voxel_ymax)
        position_z = np.random.uniform(voxel_zmin, voxel_zmax)

        #### CREATE CELL DICT
        cell_new = {"position": [position_x,
                                 position_y,
                                 position_z],
                    "shape": np.ravel(shape).tolist(),
                    "color": "#5db172"}

        #### CHECK IF CELL EXTEND THE VOXEL
        inside = check_if_ellipsoid_extends_the_voxel(cell_new, voxel)
        if not inside:
            continue

        #### CHECK FOR OVERLAP WITH PREVIOUSLY PLACED CELLS
        separated = [True] # add one True for it to work for the first cell

        for cell in config["cells"]:
            separated.append(are_ellipsoids_separated(cell_new, cell))

            # exit if just one pair of cells turns out to not be separated
            if not separated[-1]:
                continue

        if all(separated):
            # UPDATE VOLUME
            CV_current += 4/3 * np.pi * l1 * l2 * l3
            #print(CV_current, CV_current/voxel_volume)
            # ADD TO CONFIG
            config["cells"].append(cell_new)
        else:
            # try another one
            pass

        path_config_with_cells = path_config.replace('.json', '-with_cells.json')

        json.dump(config, open(path_config_with_cells, 'w'), indent=4)

    return path_config_with_cells
