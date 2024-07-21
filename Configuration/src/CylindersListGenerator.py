import sys
import os
import numpy as np
import matplotlib.pyplot as plt
import scipy.stats as stats
from tqdm.auto import tqdm

#### plotting
SMALLER_SIZE = 28
BIGGER_SIZE = 34
plt.rc('font', size=SMALLER_SIZE)          # controls default text sizes
plt.rc('axes', titlesize=SMALLER_SIZE)     # fontsize of the axes title,
plt.rc('axes', labelsize=SMALLER_SIZE)     # fontsize of the x and y labels
plt.rc('xtick', labelsize=SMALLER_SIZE)    # fontsize of the tick labels
plt.rc('ytick', labelsize=SMALLER_SIZE)    # fontsize of the tick labels
plt.rc('legend', fontsize=SMALLER_SIZE)    # legend fontsize
plt.rc('figure', titlesize=BIGGER_SIZE)    # fontsize of the figure title

#plt.rc('text', usetex=True)
plt.rc('font', family='serif')


class CylindersListGenerator():

    def __init__(
        self, 
        path_substrates=None,
        name_experiment=None, 
        path_config_file=None,
        g_ratios=[], 
        fracs_demyelination=[],
        targetFVFs=None, 
        rs=None,
    ):

        self.path_substrates = self.path_tmp = path_substrates
        if (self.path_substrates != None) and (not os.path.exists(self.path_substrates)):
            os.makedirs(self.path_substrates)
        self.name_experiment = name_experiment
        self.path_config_file = path_config_file
        self.g_ratios = g_ratios
        self.fracs_demyelination = fracs_demyelination

        ####
        self.targetFVFs = targetFVFs # will be overwritten unless rs is also specified to create hexagonal packing
        self.rs = rs # only for hexagonal packing
        ####

    def get_parameters_for_MCDC_config_file(
            self, 
            path_scheme_file, 
            path_output,
            alpha, 
            beta, 
            targetFVF, 
            num_cylinders, 
            num_process=4
        ):

        #### simple
        parameters_simple = {
            'N' : 1,
            'T' : 1,
            'duration' : 0.00001,
            'diffusivity' : 1e-15, #make only a tiny, tiny step
            'deportation' : 1,
            'write_txt' : 0,
            'write_bin' : 1,
            'write_traj_file' : 0,
            'scale_from_stu' : 1,
            'num_process' : num_process,
            'verbatim' : 0,
            'scheme_file' : path_scheme_file,
            'out_traj_file_index' : path_output+'/',
        }

        #### complex
        cylinder_gamma_packing = {
            'output_conf' : "''", # this parameter is out of order.
            'alpha' : alpha,
            'beta' : beta,
            'icvf' : targetFVF,
            'num_cylinders' : num_cylinders,
        }

        parameters_complex = {
            'obstacle' : {
                'cylinder_gamma_packing' : cylinder_gamma_packing
            }
        }

        parameters = {
            'parameters_simple' : parameters_simple,
            'parameters_complex' : parameters_complex,
        }

        return parameters

    def generate_cylinders_lists(self, n):

        for _ in tqdm(range(n)):
            os.system(f'MC-DC_Simulator {self.path_config_file}')

    #### Loading

    def load_cylinders_list(self, path_cylinders_list_oi):

        with open(path_cylinders_list_oi) as f:

            for line in f:
                scale_cylinders_list = float(line)
                break

        cylinders_list = np.atleast_2d(np.loadtxt(path_cylinders_list_oi, skiprows=1, delimiter=' '))
        # cylinders_list *= scale_cylinders_list

        return cylinders_list, scale_cylinders_list
    
    #### Some analysis/statistics

    def get_voxel_corners(self, path_file):

        with open(path_file, 'r') as file:

            lines = file.readlines()

        lines_oi = lines[-2:]

        tmp = [line.strip().split() for line in lines_oi]

        voxel_xmin, voxel_ymin, voxel_zmin = float(tmp[0][1]), float(tmp[0][2]), float(tmp[0][3])
        voxel_xmax, voxel_ymax, voxel_zmax = float(tmp[1][1]), float(tmp[1][2]), float(tmp[1][3])

        return voxel_xmin, voxel_ymin, voxel_zmin, voxel_xmax, voxel_ymax, voxel_zmax

    def get_voxel_side_lengths(self):

        paths_simulation_info = np.sort([os.path.join(self.path_substrates, name) for name in os.listdir(self.path_substrates) if 'info' in name])

        lengths = []

        for path_simulation_info in paths_simulation_info:

            voxel_xmin, _, _, voxel_xmax, _, _ = self.get_voxel_corners(path_simulation_info)

            lengths.append(voxel_xmax - voxel_xmin)

        lengths = np.array(lengths)

        return lengths

    def get_voxel_side_lengths_plot(self, ax):

        scaler = 1e3

        voxel_side_lengths = self.get_voxel_side_lengths() * scaler

        ax.plot(np.ones(len(voxel_side_lengths)), voxel_side_lengths, ls='None',
            marker='.', ms=15, alpha=0.5)

        mean = np.mean(voxel_side_lengths)
        std = np.std(voxel_side_lengths)

        ax.errorbar([1], mean, std,
            marker='.', ms=15, capsize=4, mew=3, lw=3, color='gray',
            label=r'($%.2f \pm %.2f$) $\mu$m' %(mean, std))

        ax.set_xticks([])
        ax.set_ylabel('voxel side length [$\mu$m]')
        ax.legend(loc='upper center')


    def get_radius_gamma_distribution_plot(self, ax, alpha, beta):

        #### data
        paths_cylinders_list_oi = np.sort([os.path.join(self.path_substrates, name) for name in os.listdir(self.path_substrates) if ('gamma_distributed_cylinder_list' in name) and ('g_ratio' not in name)])

        max_r = 0
        rs_all = []

        for path_cylinders_list_oi in paths_cylinders_list_oi:

            tmp, scale_cylinders_list = self.load_cylinders_list(path_cylinders_list_oi)
            rs = tmp[:, -1]
            rs_all.append(rs)

            if np.max(rs) > max_r:
                max_r = np.max(rs)

        bins = np.linspace(0, max_r*1.1, 50)

        for rs in rs_all:

            ax.hist(rs, bins=bins, histtype='step', lw=2, alpha=0.5, density=True)

        #### analytic
        # Shape parameter α and an scale parameter β
        # Mean parameter μ = αβ
        x = np.linspace(0, max_r*1.1, 500)
        y = stats.gamma.pdf(x, a=alpha, scale=beta)

        ax.plot(x, y, color='gray', lw=3, label=rf'$\alpha$ = {alpha}, $\beta$ = {beta}, $\mu$ = $\alpha$$\cdot$$\beta$ = {alpha*beta} $\mu$m')

        ax.set_xlabel('radius [$\mu$m]')
        ax.set_ylabel('occurrence')
        ax.legend(loc='upper right')

    def get_diameter_gamma_distribution_plot(self, ax, alpha, beta):
        """

        Background:
            If X is a gamma random variable with shape and scale parameters
            (α, β), then Y = aX is a gamma random variable with parameters
            (α,aβ). [1]

            [1] https://en.wikipedia.org/wiki/Relationships_among_probability_distributions
        """


        #### data
        paths_cylinders_list_oi = np.sort([os.path.join(self.path_substrates, name) for name in os.listdir(self.path_substrates) if ('gamma_distributed_cylinder_list' in name) and ('g_ratio' not in name)])

        max_d = 0
        ds_all = []

        for path_cylinders_list_oi in paths_cylinders_list_oi:

            tmp, scale_cylinders_list = self.load_cylinders_list(path_cylinders_list_oi)
            ds = 2 * tmp[:, -1]
            ds_all.append(ds)

            if np.max(ds) > max_d:
                max_d = np.max(ds)

        bins = np.linspace(0, max_d*1.1, 50)

        for ds in ds_all:

            ax.hist(ds, bins=bins, histtype='step', lw=2, alpha=0.5, density=True)

        #### analytic
        # Shape parameter α and an scale parameter β
        # Mean parameter μ = αβ
        x = np.linspace(0, max_d*1.1, 500)
        y = stats.gamma.pdf(x, a=alpha, scale=2*beta)

        ax.plot(x, y, color='gray', lw=3, label=rf'$\alpha$ = {alpha}, $\beta$ = {2*beta}, $\mu$ = $\alpha$$\cdot$$\beta$ = {alpha*2*beta} $\mu$m')

        ax.set_xlabel('diameter [$\mu$m]')
        ax.set_ylabel('occurrence')
        ax.legend(loc='upper right')

    def generate_overview_plot(self, alpha, beta):

        #### radius version
        fig, axs = plt.subplots(1, 2, figsize=(23,10), gridspec_kw={'width_ratios': [5, 2]})

        self.get_radius_gamma_distribution_plot(axs[0], alpha, beta)
        self.get_voxel_side_lengths_plot(axs[1])

        plt.savefig(f'{self.path_substrates}/overview_radius', bbox_inches="tight")

        #### diameter version
        fig, axs = plt.subplots(1, 2, figsize=(23,10), gridspec_kw={'width_ratios': [5, 2]})

        self.get_diameter_gamma_distribution_plot(axs[0], alpha, beta)
        self.get_voxel_side_lengths_plot(axs[1])

        plt.savefig(f'{self.path_substrates}/overview_diameter', bbox_inches="tight")

    #### Plot example
    def generate_example_plots(self, N):

        tags_0 = ['-frac_demyelination=0.0'] + [f'-frac_demyelination={frac_demyelination}' for frac_demyelination in self.fracs_demyelination]

        if (len(tags_0) == 0) or (len(self.fracs_demyelination) == 0):
            tags_0 = ['']

        tags_1 = [f'-g_ratio={g_ratio}' for g_ratio in self.g_ratios]

        if len(tags_1) == 0:
            tags_1 = ['']

        for tag_0 in tags_0:
            for tag_1 in tags_1:

                paths_cylinders_lists = np.sort([os.path.join(self.path_substrates, name) for name in os.listdir(self.path_substrates) if ('gamma_distributed_cylinder_list' in name) and (tag_0 in name) and (tag_1 in name)])

                paths_simulation_info = np.sort([os.path.join(self.path_substrates, name) for name in os.listdir(self.path_substrates) if 'info' in name])

                scaler = 1e3

                for path_cylinders_list, path_simulation_info in zip(paths_cylinders_lists[:N], paths_simulation_info[:N]):

                    cylinders_list, scale_cylinders_list = self.load_cylinders_list(path_cylinders_list)
                    voxel_xmin, voxel_ymin, _, voxel_xmax, voxel_ymax, _ = self.get_voxel_corners(path_simulation_info)

                    #### generate figure
                    fig, ax = plt.subplots(1, 1, figsize=(14, 14))

                    # plot cylinder cross sections (circles)
                    for cylinder in cylinders_list:

                        x = cylinder[0]
                        y = cylinder[1]
                        r = cylinder[-1]

                        circle = plt.Circle((x, y), r, fill=False, lw=1.5, alpha=0.5)

                        ax.add_artist(circle)

                    # plot voxel cross section (square)
                    xmin = voxel_xmin * scaler
                    xmax = voxel_xmax * scaler
                    ymin = voxel_ymin * scaler
                    ymax = voxel_ymax * scaler
                    width = (voxel_xmax - voxel_xmin) * scaler
                    heigth = (voxel_ymax - voxel_ymin) * scaler
                    rectangle = plt.Rectangle((xmin, ymin), width, heigth, fill=False, lw=2, color='gray')

                    ax.add_artist(rectangle)

                    ax.set_xlim(xmin-0.1*xmax, xmax+0.1*xmax)
                    ax.set_ylim(ymin-0.1*ymax, ymax+0.1*ymax)

                    ax.set_xlabel('x [$\mu$m]')
                    ax.set_ylabel('y [$\mu$m]')

                    # plt.savefig(f'{self.path_substrates}example', bbox_inches="tight")
                    name_figure = '_'.join(path_cylinders_list.split('/')[-1].split('_')[:2]) + '_plot' + f'{tag_0}' + f'{tag_1}'
                    plt.savefig(f'{self.path_substrates}/{name_figure}.png', bbox_inches="tight")
                    plt.close('all')

