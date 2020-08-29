import React from "react";

export default props => (
    <>
        In the "After setup" pane you can specify:
        <ul>
            <li>
                <b>Grow speed</b> - This is how much the axons grow per step. A value of 0 means no growth and a value
                of 1 means that it should grow to 100% of its target size in 1 step. If close to 0 there will be fewer
                numerical errors but the algorithm will require more steps i total.
            </li>
            <li>
                <b>Contract speed</b> - This is how much the axons will contract per step, i.e. how "stiff" the axons
                are. A value of 0 means that neighboring ellipsoids of an axon won't try to stay together. The maximum
                value is 1.
            </li>
            <li>
                <b>Minimum distance</b> - This is the minimum allowed space between axons. If set to 0 the axons can
                touch each other.
            </li>
        </ul>
        <p>
            After specifying these value you can either turn on automatic growth which will perform grow steps until the
            volume fraction has reached a specified value, or you can click the "Perform 1 grow step" button to perform
            just 1 step at a time.
        </p>
        <p>
            Below the two buttons the estimated volume fractions will be displayed. These fractions are estimated by
            counting the number of points in a lattice that fall within either an axon or a cell and dividing by the
            volume of the voxel.
        </p>
        <p>
            In the bottom of the pane you can see which part of a grow step is currently being executed. You can also
            see the number of completed grow steps.
        </p>
    </>
);
