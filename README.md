# The White Matter Generator (WMG)

Enabling the exploration of white matter dynamics and morphology through interactive numerical phantoms.

<em>"Brain white matter is a dynamic environment that continuously adapts and reorganizes in response to stimuli and pathological changes. Glial cells, especially, play a key role in tissue repair, inflammation modulation, and neural recovery. The movements of glial cells and changes in their concentrations can influence the surrounding axon morphology. We introduce the White Matter Generator (WMG) tool to enable the study of how axon morphology is influenced through such dynamical processes, and how this, in turn, influences the diffusion-weighted MRI signal. This is made possible by allowing interactive changes to the configuration of the phantom generation throughout the optimization process. The phantoms can consist of myelinated axons, unmyelinated axons, and cell clusters, separated by extra-cellular space. Due to morphological flexibility and computational advantages during the optimization, the tool uses ellipsoids as building blocks for all structures; chains of ellipsoids for axons, and individual ellipsoids for cell clusters. After optimization, the ellipsoid representation can be converted to a mesh representation which can be employed in Monte-Carlo diffusion simulations. This offers an effective method for evaluating tissue microstructure models for diffusion-weighted MRI in controlled bio-mimicking white matter environments. Hence, the WMG offers valuable insights into white matter's adaptive nature and implications for diffusion-weighted MRI microstructure models, and thereby holds the potential to advance clinical diagnosis, treatment, and rehabilitation strategies for various neurological disorders and injuries."</em> [Winther and Peulicke, 2024]

Try the online demo [here](https://map-science.github.io/WhiteMatterGenerator).

### Citation

This repository represents the paper ["Exploring white matter dynamics and morphology through interactive numerical phantoms: the White Matter Generator"](https://www.frontiersin.org/journals/neuroinformatics/articles/10.3389/fninf.2024.1354708/full).

When using any content from the repository, please cite the paper: <em>"Winther S, Peulicke O, Andersson M, Kjer HM, Bærentzen JA, Dyrby TB. Exploring white matter dynamics and morphology through interactive numerical phantoms: the White Matter Generator. Front Neuroinform. 2024 Jul 31;18:1354708. doi: 10.3389/fninf.2024.1354708. PMID: 39144684; PMCID: PMC11322502."</em>

### Content

- [white-matter-generator](https://github.com/MaP-science/WhiteMatterGenerator/tree/main/white-matter-generator): The command line interface
- [Examples](https://github.com/MaP-science/WhiteMatterGenerator/tree/main/Examples): Python-wrapped examples for getting started
  - [Setting up biologically informed configurations](https://github.com/MaP-science/WhiteMatterGenerator/blob/main/Examples/notebooks/configuration.ipynb)
  - [Inspecting and simplifying axon and myelin meshes before computationally demanding applications](https://github.com/MaP-science/WhiteMatterGenerator/blob/main/Examples/notebooks/show_and_simplify_meshes.ipynb)
  - [Analysing and comparing the morphology of WMG-generated axons with that of real axons](https://github.com/MaP-science/WhiteMatterGenerator/blob/main/Examples/notebooks/morphology_analysis.ipynb)
