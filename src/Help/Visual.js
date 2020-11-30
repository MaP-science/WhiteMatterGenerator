import React from "react";

export default () => (
    <>
        In the "Visual" pane you can specify how the generated substrate should be displayed:
        <ul>
            <li>
                <b>Voxels</b>
                <ul>
                    <li>
                        <b>Hide</b> - Hide the voxels.
                    </li>
                    <li>
                        <b>Show</b> - Show the voxels.
                    </li>
                </ul>
            </li>
            <li>
                <b>Axons</b>
                <ul>
                    <li>
                        <b>Hide</b> - Hide the axons.
                    </li>
                    <li>
                        <b>Ellipsoids</b> - Display the aoxns as chains of ellipsoids (this is what is used by the
                        algorithm).
                    </li>
                    <li>
                        <b>Skeleton</b> - Display the axons as skeletons (a line strip that represents the center of the
                        axon).
                    </li>
                    <li>
                        <b>Pipes</b> - Display the axons as hollow "pipes" (should be used when exporting).
                    </li>
                </ul>
            </li>
            <li>
                <b>Cells</b>
                <ul>
                    <li>
                        <b>Hide</b> - Hide the cells.
                    </li>
                    <li>
                        <b>Show</b> - Show the cells.
                    </li>
                </ul>
            </li>
        </ul>
        Clicking the "Export" button will export the currently displayed scene in PLY format. Clicking the "Export
        single axon" button and then clicking on an axon will export that axon in PLY format.
    </>
);
