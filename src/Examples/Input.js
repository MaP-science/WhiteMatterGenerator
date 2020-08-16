import React from "react";
import { Link } from "react-router-dom";

const inputExample = {
    voxelSizeInner: 9,
    voxelSizeOuter: 10,
    jointDensity: 100,
    grow: 0.05,
    contract: 0.05,
    mapFromDiameterToDeformationFactor: {
        from: [0, 0.8, 2],
        to: [0, 0.5, 1]
    },
    mapFromMaxDiameterToMinDiameter: {
        from: [0, 1],
        to: [0, 0.2]
    },
    axons: [
        {
            position: [0, 0, 0],
            direction: [1, 0, 0],
            maxDiameter: 1
        },
        {
            position: [1, 0.1, 0],
            direction: [1, 1, 1],
            maxDiameter: 0.5
        }
    ],
    cells: [
        {
            position: [2, 1, 0],
            shape: [1.5, 0, 0, 0, 1, 0, 0, 0, 1]
        }
    ]
};

export default props => {
    const content = JSON.stringify(inputExample, null, 4);
    return (
        <>
            In the setup phase you can provide an input file. In this example create a new file and put in the
            following:
            <pre>{content}</pre>
            and save the file as e.g. "input.json" (or click{" "}
            <button
                onClick={() => {
                    const link = document.createElement("a");
                    link.setAttribute("href", "data:text/json;charset=utf-8," + content);
                    link.setAttribute("download", "input.json");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }}>
                here
            </button>{" "}
            to download the file). Click the "Upload input file" button and select the file. This should initialize 2
            axons and 1 cell in the specified positions.
            <br />
            <Link to="/help/setup">Click here to see a description of the input file format.</Link>
        </>
    );
};
