import numpy as np
import os
import json
from sklearn.decomposition import PCA
import math
import matplotlib.pyplot as plt
import scipy.stats as stats
from scipy.stats import gamma
from scipy.optimize import curve_fit
from sklearn.metrics import r2_score



def get_colors_without_cells():
    return iter(['#f2b8c4', '#d9415f', 'darkred'])



def get_colors_with_cells():
    return iter(['darkturquoise', 'dodgerblue', 'navy'])



def get_sinousity_from_centreline(centreline):
    
    position_a = np.array(centreline[0])
    position_b = np.array(centreline[-1])

    length_straight = np.linalg.norm(position_b - position_a)

    length_along_traj = np.sum(np.linalg.norm(np.diff(centreline, axis=0), axis=1))
    
    sinousity = length_along_traj / length_straight
    
    return sinousity



def get_max_deviation_from_centreline(centreline):
    
    position_a = np.array(centreline[0])
    position_b = np.array(centreline[-1])

    distance_max = -np.inf
        
    for position_c in centreline:

        distance = np.linalg.norm(np.cross(position_b-position_a, position_a-position_c))/np.linalg.norm(position_b-position_a)

        if distance > distance_max:
            distance_max = distance
    
    return distance_max



# def get_synchrotron_dict(path_centrelines):
def get_morphological_metrics_from_centrelines(path_centrelines):
    
    metrics = {
        'axonCentrelines': [],
        'axonSinousity': [],
        'axonMaxDeviation': [],
        'axonDiameters': [],
        'axonDiameters_mean': [],
        'axonDiameters_std': [],
        'axonEccentricities': [],
        'axonEccentricities_mean': [],
        'axonEccentricities_std': [],
    }

    for name_axon in np.sort(os.listdir(path_centrelines)):

        path_axon = os.path.join(path_centrelines, name_axon)

        quantified = np.loadtxt(path_axon, delimiter=',') # x [voxel-coords], y [voxel-coords], z [voxel-coords], tx, ty, tz, diameter [mm], eccentricity

        axonCentreline = quantified[:, :3] * 0.5 #
        axonSinousity = get_sinousity_from_centreline(axonCentreline)
        axonMaxDeviation = get_max_deviation_from_centreline(axonCentreline)
        axonDiameter = quantified[:, 6] * 1e3
        axonDiameter_mean = np.mean(axonDiameter)
        axonDiameter_std = np.std(axonDiameter)
        axonEccentricity = quantified[:, -1]
        axonEccentricity_mean = np.mean(axonEccentricity)
        axonEccentricity_std = np.std(axonEccentricity)

        metrics['axonCentrelines'].append(axonCentreline)
        metrics['axonSinousity'].append(axonSinousity)
        metrics['axonMaxDeviation'].append(axonMaxDeviation)
        metrics['axonDiameters'].append(axonDiameter)
        metrics['axonDiameters_mean'].append(axonDiameter_mean)
        metrics['axonDiameters_std'].append(axonDiameter_std)
        metrics['axonEccentricities'].append(axonEccentricity)
        metrics['axonEccentricities_mean'].append(axonEccentricity_mean)
        metrics['axonEccentricities_std'].append(axonEccentricity_std)
        
    return metrics



def get_morphological_metrics_from_WMG_config(path_config, dist_sampling=0.5):

    """
    dist_sampling = 0.5 [um] is set to match the sampling distance with that applied to the 
    centrelines extracted from the XNH-images.
    """

    alpha = float(path_config.split('alpha=')[-1].split('-')[0])
    beta = float(path_config.split('beta=')[-1].split('-')[0])
    
    metrics = {
        'axonCentrelines': [],
        'axonSinousity': [],
        'axonMaxDeviation': [],
        'axonDiameters': [],
        'axonDiameters_mean': [],
        'axonDiameters_std': [],
        'myelinDiameters': [],
        'myelinDiameters_mean': [],
        'myelinDiameters_std': [],
        'myelinEquivalentDiameters': [],
        'myelinEquivalentDiameters_mean': [],
        'myelinEquivalentDiameters_std': [],
        'maxDiameter': [],
        'nEllipsoids': [],
        'axonEccentricities': [],
        'axonEccentricities_mean': [],
        'axonEccentricities_std': [],
        'alpha_desired': alpha,
        'beta_desired': beta,
        'axonPCAs': [],
    }
    
    with open(path_config, 'r') as file:
        config = json.load(file)
    
    for axon in config['axons']:
        
        ##### PER AXON
        axonCentreline = []
        axonDiameter = []
        myelinDiameter = []
        myelinEquivalentDiameter = []
        axonEccentricities = []

        for ellipsoid in axon['ellipsoids']:
            
            if len(axonCentreline) > 0:
                
                pass
            
            if (len(axonCentreline) == 0) or (math.dist(axonCentreline[-1], ellipsoid['position']) > dist_sampling):
            
                axonCentreline.append(ellipsoid['position'])

                axonDiameter.append(ellipsoid['axonDiameter']) 

                myelinDiameter.append(ellipsoid['myelinDiameter']) # 2 * np.sqrt(S[0, 0] * S[1, 1]), or 2 * np.sqrt(np.linalg.det(S) / S[2, 2])

                # equivalent diameter: the diameter of a circle which has an area equal to that of the ellipse
                S = np.reshape(ellipsoid['shape'], (3, 3))
                area_ellipse = np.pi * S[0, 0] * S[1, 1]
                d_equivalent_circle = 2 * np.sqrt(area_ellipse / np.pi)
                myelinEquivalentDiameter.append(d_equivalent_circle)

                a, b = max(S[0, 0], S[1, 1]), min(S[0, 0], S[1, 1])
                eccentricity = np.sqrt(1-b**2/a**2)
                axonEccentricities.append(eccentricity)
                
            else:
                pass

        # compute stuff
        axonSinousity = get_sinousity_from_centreline(axonCentreline)
        axonMaxDeviation = get_max_deviation_from_centreline(axonCentreline)
        axonDiameter_mean = np.mean(axonDiameter)
        axonDiameter_std = np.std(axonDiameter)
        myelinDiameter_mean = np.mean(myelinDiameter)
        myelinDiameter_std = np.std(myelinDiameter)
        myelinEquivalentDiameter_mean = np.mean(myelinEquivalentDiameter)
        myelinEquivalentDiameter_std = np.std(myelinEquivalentDiameter)
        nEllipsoids = len(axonCentreline)
        axonEccentricities_mean = np.mean(axonEccentricities)
        axonEccentricities_std = np.std(axonEccentricities)
        
        pca = PCA(n_components=3)
        pca.fit(axonCentreline)
        eigvals, eigvecs = pca.explained_variance_, pca.components_
        
        # add to dict
        metrics['axonCentrelines'].append(axonCentreline)
        metrics['axonSinousity'].append(axonSinousity)
        metrics['axonMaxDeviation'].append(axonMaxDeviation)
        metrics['axonDiameters'].append(axonDiameter)
        metrics['axonDiameters_mean'].append(axonDiameter_mean)
        metrics['axonDiameters_std'].append(axonDiameter_std)
        metrics['myelinDiameters'].append(myelinDiameter)
        metrics['myelinDiameters_mean'].append(myelinDiameter_mean)
        metrics['myelinDiameters_std'].append(myelinDiameter_std)
        metrics['myelinEquivalentDiameters'].append(myelinEquivalentDiameter)
        metrics['myelinEquivalentDiameters_mean'].append(myelinEquivalentDiameter_mean)
        metrics['myelinEquivalentDiameters_std'].append(myelinEquivalentDiameter_std)
        metrics['maxDiameter'].append(axon['maxDiameter'])
        metrics['nEllipsoids'].append(nEllipsoids)
        metrics['axonEccentricities'].append(axonEccentricities)
        metrics['axonEccentricities_mean'].append(axonEccentricities_mean)
        metrics['axonEccentricities_std'].append(axonEccentricities_std)
        metrics['axonPCAs'].append([eigvals, eigvecs])

    return metrics



def get_diameter_distribution_figure(path_config, metrics):

    plt.figure(figsize=(16, 7))

    color = 'tab:blue'

    xmax = 6
    bins = np.linspace(0, xmax, 100)
    xs_fit = np.linspace(np.min(bins), np.max(bins), 500)

    epsilon = path_config.split('epsilon=')[-1].split('-')[0].split('/')[0]
    
    #### Plot axonDiameters_mean
    label = 'WMG: $\epsilon$'+f'={epsilon}, CVF=0.00'

    plt.hist(metrics['axonDiameters_mean'], bins=bins, histtype='step', 
            color=color, lw=2, density=True, alpha=0.6, label=label)
    
    #### Fit WMG output to gamma-distribution
    fit_args = gamma.fit(metrics['axonDiameters_mean'])
    shape, loc, scale = fit_args
    y_norm_fit = gamma.pdf(xs_fit, *fit_args)

    label = r'$\alpha$=%.1f, $\beta$=%.1f, $\mu$=$\alpha$$\cdot$$\beta$ = %.1f' %(shape, scale, shape*scale)

    plt.plot(xs_fit, y_norm_fit, lw=3, color=color, label=label)
        
    #### Get desired gamma-distribution
    alpha = float(path_config.split('alpha=')[-1].split('-')[0])
    beta = float(path_config.split('beta=')[-1].split('-')[0])
        
    x = np.linspace(0, np.max(xmax), 500)
    y = stats.gamma.pdf(x, a=alpha, scale=2*beta)

    plt.plot(x, y, color='gray', lw=3, label='Target:\n'+rf'$\alpha$={alpha}, $\beta$={2*beta}, $\mu$=$\alpha$$\cdot$$\beta$ = {alpha*2*beta}')

    #### Layout
    handles, labels = plt.gca().get_legend_handles_labels()
    # order = [1, 2, 0]
    # handles, labels = [handles[idx] for idx in order], [labels[idx] for idx in order]
    plt.legend(handles, labels, fontsize=20)

    plt.xlabel('mean(AD) [$\mu$m]')
    plt.ylabel('occurences [-]')

    plt.show()



def func_line(x, a, b):
        return a*x + b



def get_std_vs_mean_diameter_figure(metrics_list, labels_list):

    plt.figure(figsize=(7, 7))

    alpha = 0.5

    for metrics, label in zip(metrics_list, labels_list):

        plot = plt.scatter(
            metrics['axonDiameters_mean'], 
            metrics['axonDiameters_std'], 
            # color=color_CC, 
            alpha=alpha, 
            label=label
        )
   
        # fit
        popt, pcov = curve_fit(func_line, metrics['axonDiameters_mean'], metrics['axonDiameters_std'])
        y_pred = func_line(np.array(metrics['axonDiameters_mean']), *popt)

        # r_squared
        r_squared = r2_score(metrics['axonDiameters_std'], y_pred)

        # plot
        label = 'y = %.2fx + %.2f, R$^2$ = %.2f' %(popt[0], popt[1], r_squared)
        plt.plot(
            metrics['axonDiameters_mean'], 
            y_pred, 
            color=plot.get_facecolors()[0], 
            lw=3,
            label=label
        )

    #### Layout
    plt.xlabel('mean(AD) [$\mu$m]') # longitudinal axon diameter (LAD)
    plt.ylabel('std(AD) [$\mu$m]')

    #legend
    handles, labels = plt.gca().get_legend_handles_labels()
    plt.legend(handles, labels, bbox_to_anchor=(1.05, 1), loc='upper left', borderaxespad=0., fontsize=18)


    plt.grid(True)

    plt.show()



def get_eccentricity_figure(metrics_list, labels_list):

    plt.figure(figsize=(7, 7))

    alpha = 0.5

    for metrics, label in zip(metrics_list, labels_list):

        plt.scatter(
            metrics['axonEccentricities_mean'], 
            metrics['axonEccentricities_std'], 
            # color=color_CC, 
            alpha=alpha, 
            label=label
        )

    #### Layout
    plt.xlabel('mean(eccentricity) [-]') # longitudinal axon diameter (LAD)
    plt.ylabel('std(eccentricity) [-]')

    #legend
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left', borderaxespad=0., fontsize=16)

    plt.grid(True)

    plt.show()



def get_tortuosity_figure(metrics_list, labels_list):

    plt.figure(figsize=(7, 7))

    alpha = 0.4

    for metrics, label in zip(metrics_list, labels_list):
    
        plt.scatter(
            metrics['axonSinousity'], 
            metrics['axonMaxDeviation'],
            alpha=alpha, 
            label=label
        )

    # Layout

    plt.grid(True)
    plt.xlabel('tortuosity factor [-]')
    plt.ylabel('maximum deviation [$\mu$m]')
    plt.legend(bbox_to_anchor=(1.05, 1), loc=2, borderaxespad=0., fontsize=16)

    plt.show()