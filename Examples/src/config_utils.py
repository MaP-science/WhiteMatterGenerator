import os
import sys
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mc
import json
from tqdm.auto import tqdm
import datetime
from datetime import datetime
from datetime import timedelta as timedelta
import copy
from scipy.spatial.transform import Rotation

sys.path.append('../')
from src.GenerateMCDCConfigFile import GenerateMCDCConfigFile
from src.CylindersListGenerator import CylindersListGenerator



def generate_cylinder_list(
        alpha, 
        beta, 
        targetFVF, 
        num_cylinders, 
        N_reps,
        path_output,
    ):

    """
    Uses MCDC to generate cylinder_lists.

    """

    #### paths

    # input paths
    path_MCDC_config = os.path.join(path_output, 'MCDC.conf') 
    path_MCDC_scheme = f'../resources/dummy.scheme'

    #### initialize
    CLG = CylindersListGenerator(
        path_substrates=path_output,
        name_experiment='', 
        path_config_file=path_MCDC_config,
        g_ratios=[],
        fracs_demyelination=[]
    )

    #### generate configuration-file
    parameters = CLG.get_parameters_for_MCDC_config_file(
        path_MCDC_scheme,
        path_output,
        alpha, beta, targetFVF,
        num_cylinders,
        num_process=12
    )

    MCDC_config_file_generator = GenerateMCDCConfigFile(
        path_MCDC_config,
        allow_overwrite=True,
        **parameters
    )

    MCDC_config_file_generator.write_file()

    #### generate cylinders_lists
    CLG.generate_cylinders_lists(N_reps)

    #### plots for checking
    # some statistics
    CLG.generate_overview_plot(alpha, beta)

    # don't show all the figures here
    plt.close('all')



def get_length_voxel_isotropic(path_cylinder_list, path_simulation_info,
                               buffer_frac=1.0):
    """

    """

    cylinder_list, scale_cylinder_list = CylindersListGenerator().load_cylinders_list(path_cylinder_list)

    x_mins = cylinder_list[:, 0] - cylinder_list[:, -1]
    x_maxs = cylinder_list[:, 0] + cylinder_list[:, -1]
    y_mins = cylinder_list[:, 1] - cylinder_list[:, -1]
    y_maxs = cylinder_list[:, 1] + cylinder_list[:, -1]

    x_max_distance = max(x_maxs) - min(x_mins)
    y_max_distance = max(y_maxs) - min(y_mins)

    length_voxel_isotropic_min = max(x_max_distance, y_max_distance)

    length_voxel_isotropic = length_voxel_isotropic_min * buffer_frac

    return length_voxel_isotropic



def get_direction(epsilon, fiber_orientation=np.array([0, 0, 1])):
    """
    phi is the angle from the main fiber direction.
    """

    theta = np.random.uniform(0, 2*np.pi)

    z_projection = np.sin((1 - epsilon) * np.pi/2)

    z_sample = np.random.uniform(0+z_projection, 1)

    phi = np.arccos(z_sample)

    x = np.sin(phi) * np.cos(theta)
    y = np.sin(phi) * np.sin(theta)
    z = np.cos(phi)

    direction = np.array([x, y, z])

    initial_orientation = np.array([0, 0, 1])
    fiber_orientation = fiber_orientation/np.linalg.norm(fiber_orientation) # make sure this is a unit vector
    delta = initial_orientation - fiber_orientation

    direction = direction - delta

    return direction.tolist()



def get_axons_list(path_cylinder_list, path_simulation_info,
                   fibers,
                   d_pm_frac,
                   length_voxel_isotropic, epsilon, g_ratio=None,
                   color_mode='fiber', mode_fiber='sheets'):
    """
    
    """

    axons = []

    cylinder_list, scale_cylinder_list = CylindersListGenerator().load_cylinders_list(path_cylinder_list)

    n_cylinders = len(cylinder_list)

    #n_fibers = len(fibers.keys())
    fibers_fracs = np.array([fibers[key]['frac'] for key in fibers.keys()])

    n_axons_per_fiber = np.round(fibers_fracs * n_cylinders, 0).astype(int) #[int(frac*n_cylinders) if (i<n_cylinders-1) else   for i, frac in enumerate(fibers_fracs)]

    # corrections in case np.sum(n_axons_per_fiber) < n_cylinders
    _i = 0
    while np.sum(n_axons_per_fiber) < n_cylinders:
        n_axons_per_fiber[_i] += 1
        _i +=1

    # make list of fiber indicies
    if mode_fiber == 'sheets':
        # fibers will be divided along x

        pos_x = cylinder_list[:, 0]

        idxs_sorted_pos_x = np.argsort(pos_x)

        idxs_fibers = np.ones(np.sum(n_axons_per_fiber)).astype(int)

        for idx in range(len(n_axons_per_fiber)):

            if idx == 0:
                # first fiber
                idxs_oi = idxs_sorted_pos_x[:n_axons_per_fiber[idx]]
                idxs_fibers[idxs_oi] = int(idx)
            elif idx == len(n_axons_per_fiber) - 1:
                # last fiber
                idxs_oi = idxs_sorted_pos_x[-n_axons_per_fiber[idx]:]
                idxs_fibers[idxs_oi] = int(idx)
            else:
                idxs_oi = idxs_sorted_pos_x[n_axons_per_fiber[idx-1]:n_axons_per_fiber[idx-1]+n_axons_per_fiber[idx]]
                idxs_fibers[idxs_oi] = int(idx)

    elif mode_fiber == 'mixed':

        idxs_fibers = []
        for i, n in enumerate(n_axons_per_fiber):
            idxs_fibers += [i,] * int(n)

        np.random.shuffle(idxs_fibers)

    #### get voxel specs
    voxel_xmin, _, _, voxel_xmax, _, _ = CylindersListGenerator().get_voxel_corners(path_simulation_info)
    len_voxel_MCDC = (voxel_xmax - voxel_xmin) * 1e3

    #directions = [get_direction(epsilon, fiber_orientation) for _ in range(len(cylinder_list))]

    directions = [fibers[list(fibers.keys())[idx_fiber]]['orientation'] for idx_fiber in idxs_fibers]
    directions = [get_direction(fibers[list(fibers.keys())[idx_fiber]]['epsilon'], fibers[list(fibers.keys())[idx_fiber]]['orientation']) for idx_fiber in idxs_fibers]
    directions = directions / np.linalg.norm(directions, axis=-1)[:, np.newaxis]#np.atleast_2d(np.linalg.norm(directions, axis=-1)).T
    directions = directions.tolist()

    g_ratios = [g_ratio,] * len(cylinder_list) #### TODO: Should g_ratios have some variance?

    if color_mode == 'random':
        # set colors at random
        colors = plt.cm.gist_ncar(np.linspace(0, 1, len(cylinder_list)))
    elif color_mode == 'diameter':
        # set color to be propertional to maxDiameter of the axon
        colors = plt.cm.OrRd(cylinder_list[:, -1] / np.max(cylinder_list[:, -1]))
    elif color_mode == 'fiber':
        # TODO: implement colouring according to assignmet fiber for validation purposes
        colors = plt.cm.gist_ncar(idxs_fibers / np.max(idxs_fibers))

    for cylinder, direction, color, g_ratio in zip(cylinder_list, directions, colors, g_ratios):

        x_0, y_0, z_0, _, _, _, r = cylinder

        # translate to be centered around x=0, y=0
        x_0 = x_0 - len_voxel_MCDC / 2
        y_0 = y_0 - len_voxel_MCDC / 2

        # distribute uniformly along z
        z_0 = np.random.uniform(-length_voxel_isotropic/2, length_voxel_isotropic/2)

        axon = {'position' : [x_0, y_0, z_0],
                'direction' : direction,
                #'maxDiameter' : r*2,
                'maxDiameter' : r*2 + r*2*d_pm_frac,
                'color' : mc.to_hex(color),
                'gRatio' : g_ratio,
               }

        axons.append(axon)

    return axons



def get_cells_list():
    """
    TODO
    """

    return []



def generate_config_files(
        path_substrates, 
        alphas, 
        betas, 
        targetFVFs, 
        nums_cylinders,
        N_reps,
        fibers,
        ellipsoidDensityScaler,
        growSpeed, 
        contractSpeed, 
        minimumDistance,
        mapFromDiameterToDeformationFactor, 
        mapFromMaxDiameterToMinDiameter,
        d_pm_frac=0.25,
        color_mode='diameter',
        mode_fiber='None',
    ):

    mapFromMaxDiameterToEllipsoidSeparation = {
        'from': [1.0, 2.0],
        'to': [1.0*ellipsoidDensityScaler, 2.0*ellipsoidDensityScaler],
    }

    #### tests
    assert np.round(np.sum([fibers[key]['frac'] for key in fibers.keys()]), 2) == 1.0, 'np.sum(fiber_fractions) != 1.0'

    for key, value in fibers.items():
        norm = np.linalg.norm(value['orientation'])
        if norm != 1:
            fibers[key]['orientation'] = (np.array(value['orientation']) / norm).tolist()
            print(f"[OBS] The orientation of '{key}' was not provided as a unit vector.")
            print(f"[OBS] It was therefore corrected to {fibers[key]['orientation']}\n")

    #### the purpose
    paths_config_files = []

    for alpha in alphas:
        for beta in betas:
            for targetFVF in targetFVFs:
                for num_cylinders in nums_cylinders:

                        #### generate substrate name
                        name_substrate = f'cylinders-alpha={alpha}-beta={beta}-targetFVF={targetFVF}-num_cylinders={num_cylinders}-mode_fiber={mode_fiber}'

                        for key, value in fibers.items():
                            frac = value['frac']
                            orientation = str(value['orientation']).replace(' ', '') # spaces are no-go
                            epsilon = value['epsilon']

                            #name_substrate += f'-{key}_frac={frac}_orientation={orientation}_epsilon={epsilon}'
                            name_substrate += f'-{key}-frac={frac}-orientation={orientation}-epsilon={epsilon}'

                        print(f'[LOG] Generating {N_reps} substrate(s) under the name: {name_substrate}\n')

                        path_output = os.path.join(path_substrates, name_substrate)

                        #### generate cylinder_lists with MCDC
                        generate_cylinder_list(
                            alpha, 
                            beta, 
                            targetFVF, 
                            num_cylinders, 
                            N_reps, 
                            path_output
                        )

                        #### generate config-file
                        # get all substrate paths
                        paths_cylinder_lists = [os.path.join(path_output, name) for name in os.listdir(path_output) if 'cylinder_list' in name]
                        paths_simulation_info = [os.path.join(path_output, name) for name in os.listdir(path_output) if 'info' in name]

                        assert len(paths_cylinder_lists) == len(paths_simulation_info), 'len(paths_cylinder_lists) != len(paths_simulation_info)'

                        # loops of N_reps
                        for path_simulation_info, path_cylinder_list in zip(paths_simulation_info, paths_cylinder_lists):

                            # size of voxel
                            length_voxel_isotropic = get_length_voxel_isotropic(
                                path_cylinder_list,
                                path_simulation_info,
                                buffer_frac=1.0
                            )

                            with open(path_simulation_info, 'r') as file:
                                line_last = file.readlines()[-1]
                            length_voxel_MCDC = 1e3 * float(line_last.replace('(', '').replace(')', '').strip().split(' ')[0])
                            border = (length_voxel_isotropic - length_voxel_MCDC) / 2

                            # axons
                            axons_list = get_axons_list(path_cylinder_list, path_simulation_info,
                                                        fibers,
                                                        d_pm_frac,
                                                        length_voxel_isotropic, epsilon, g_ratio=0.7,
                                                        color_mode=color_mode,
                                                        mode_fiber=mode_fiber)

                            # cells
                            cells_list = get_cells_list()

                            # collect to dict
                            input_dict = {'voxelSize' : [length_voxel_isotropic,]*3,
                                          'mapFromMaxDiameterToEllipsoidSeparation' : mapFromMaxDiameterToEllipsoidSeparation,
                                          'growSpeed' : growSpeed,
                                          'contractSpeed' : contractSpeed,
                                          'border' : border,
                                          'minimumDistance' : minimumDistance,
                                          'mapFromDiameterToDeformationFactor' : mapFromDiameterToDeformationFactor,
                                          'mapFromMaxDiameterToMinDiameter' : mapFromMaxDiameterToMinDiameter,
                                          'axons' : axons_list,
                                          'cells' : cells_list,
                                         }

                            # save file
                            if 'rep_' in path_cylinder_list:
                                rep_tag = path_cylinder_list.split('rep_')[-1].split('_')[0]
                                rep_tag = int(rep_tag) + 1
                                rep_tag = f'{rep_tag:02d}'
                            else:
                                rep_tag = '00'
                            name_file = f'rep_{rep_tag}-stage=0.json'
                            path_config_file = os.path.join(path_output, name_file)
                            paths_config_files.append(path_config_file)
                            json.dump(input_dict, open(path_config_file, 'w'), indent=4)

                        
                        # clean up
                        clean_up(path_output)

    return paths_config_files


def clean_up(path_substrates):

    print('[LOG] Cleaning up...')

    # remove all filenames containing these tags
    tags_to_remove = ['.bfloat', 'simulation_info', 'MCDC.conf', 'gamma_distributed_cylinder_list']

    for name in os.listdir(path_substrates):

        if any([tag in name for tag in tags_to_remove]):

            os.remove(os.path.join(path_substrates, name))



def edit_config_file(path_config_file_original, path_config_file_new,
                     key_to_change, value_new):

    with open(path_config_file_original, 'r') as file:
        config = json.load(file)

    config[key_to_change] = value_new

    with open(path_config_file_new, 'w') as file:
        json.dump(config, file, indent=4)



def load_log(path_log):

    with open(path_log, 'r') as file:

        idxs = [] # [int] # iteration index
        AVF  = [] # [fraction] # axon volume fraction # TODO: FIGURE OUT IF THIS INCLUDES AXON AND MYELIN (I THINK IT DOES)
        CVF  = [] # [fraction] # cell volume fraction
        TVF  = [] # [fraction] # total volume fraction # cells and axons (and myelin?)
        time = [] # [s] # time spent for executing iteration

        for idx, line in enumerate(file):

            if idx == 0:
                continue
            if 'Number of max iterations reached' in line:
                #continue
                break
            if 'Number of max iterations without improvement reached' in line:
                #continue
                break
            if '            ' not in line:
                #continue
                break

            line = line.split('            ')

            idxs.append(int(line[0].split('/')[0]))
            AVF.append(float(line[1]))
            CVF.append(float(line[2]))
            TVF.append(float(line[3].split('/')[0]))

            # time
            tmp = line[4].strip().split(',')[-1]

            if idx == 1:
                time_prev = datetime.strptime(tmp, ' %d %b %Y %H:%M:%S %Z')
            else:
                time_current = datetime.strptime(tmp, ' %d %b %Y %H:%M:%S %Z')
                time.append((time_current - time_prev).total_seconds())
                time_prev = copy.copy(time_current)

    return idxs, AVF, CVF, TVF, time



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



#### CELLS ####

def add_cells_to_config(path_config, CVF_des, l1_mean, l1_std, l2_mean, l2_std,
                        rotation_lim, l3_mean=None, l3_std=None, keep_existing=False):

    # load config
    with open(path_config, "rb") as f:
        config = json.load(f)

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

        r = Rotation.from_rotvec([
            np.deg2rad(0),
            np.deg2rad(np.random.uniform(-rotation_lim, rotation_lim)),
            np.deg2rad(np.random.uniform(0, 360))
        ])

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
