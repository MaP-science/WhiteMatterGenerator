⬅️ [**Back to main**](https://github.com/MaP-science/WhiteMatterGenerator/tree/main)

# Requirements 

Setting up the environment:
- `python -m venv .venv`
- `source .venv/bin/activate`
- `pip install -r requirements.txt`
- `nodeenv -p`
- `npm i -g white-matter-generator`

Additionally:
- Install the **MC/DC Simulator*** as described [here](https://github.com/jonhrafe/MCDC_Simulator_public/blob/master/instructions/compilation.md)

*The software's `CylinderGammaDistribution()` function is used to initialize axon positions. After generating the phantoms, the same software can be used to run diffusion MRI (dMRI) simulations within them.

# Flow chart

Figure 1 from [[Winther and Peulicke, 2024]](doi.org/10.3389/fninf.2024.1354708).

<figure style="max-width: 100%; margin: 0;">
    <img src="https://www.frontiersin.org/files/Articles/1354708/fninf-18-1354708-HTML/image_m/fninf-18-1354708-g001.jpg" alt="Flow chart" style="width: 100%; height: auto;">
    <figcaption style="width: 100%; text-align: justify;">
        "<strong>Figure 1:</strong> The WMG tool can be divided into four compartments. <strong>Configuration:</strong> A config-file is generated based on a set of phantom parameters and optimization parameters. Within the config-file, all structures are represented by ellipsoids. <strong>Optimization:</strong> The optimization runs based on the config-file, and is carried out by iterating over the axonal ellipsoids. Cellular ellipsoids remain static. Maintaining consistency between the input and output format makes interactive adaptation of the configuration convenient. <strong>Re-configuration:</strong> After a round of optimization, the config-file can be adapted by changing phantom parameters (e.g., CVF and cell positions), and/or optimization parameters (e.g.,ellipsoidDensity, growSpeed and maxIterations). It can then be used as input for another round of optimization. <strong>Post-processing:</strong> After a round of optimization, the config-file can be post-processed to obtain a mesh-representation from the ellipsoid-representation. Furthermore, it is often beneficial to perform a Garland Heckbert simplification of these meshes to remove redundant vertices to reduce the computational load of e.g., Monte Carlo diffusion simulations."
    </figcaption>
</figure>
</br>

# Parameters

For **phantom parameters** and **optimization parameters**, please refer to [Section 2.1](https://www.frontiersin.org/journals/neuroinformatics/articles/10.3389/fninf.2024.1354708/full#:~:text=science/WhiteMatterGenerator.-,2.1%20Configuration,-There%20are%20two) of [[Winther and Peulicke, 2024]](doi.org/10.3389/fninf.2024.1354708). 


