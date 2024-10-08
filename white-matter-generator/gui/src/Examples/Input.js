import React from "react";
import { Link } from "react-router-dom";
import download from "in-browser-download";

const inputExample = {
    voxelSize: 10,
    growSpeed: 0.05,
    contractSpeed: 0.05,
    mapFromDiameterToDeformationFactor: {
        from: [0, 0.8, 2],
        to: [0, 0.5, 1]
    },
    mapFromMaxDiameterToMinDiameter: {
        from: [0, 1],
        to: [0, 0.2]
    },
    mapFromMaxDiameterToEllipsoidSeparation: {
        from: [0, 1],
        to: [0.1, 1]
    },
    axons: [
        {
            position: [0, 0, 0],
            direction: [1, 0, 0],
            maxDiameter: 1,
            color: "#ff0000",
            gRatio: 0.7
        },
        {
            position: [1, 0.1, 0],
            direction: [1, 1, 1],
            maxDiameter: 0.5,
            color: "#00ff00",
            gRatio: 0.5
        }
    ],
    cells: [
        {
            position: [2, 1, 0],
            shape: [1.5, 0, 0, 0, 1, 0, 0, 0, 1],
            color: "#0000ff"
        }
    ]
};

export default () => {
    const content = JSON.stringify(inputExample, null, 4);
    return (
        <>
            In the setup phase you can provide an input file. In this example create a new file and put in the
            following:
            <pre>{content}</pre>
            and save the file as e.g. "config.json" (or click{" "}
            <button onClick={() => download(content, "config.json")}>here</button> to download the file). Click the
            "Upload" button and select the file. This should initialize a red and a green axon and a blue cell at the
            specified positions.
            <br />
            <Link to="/help/setup">Click here to see a description of the input file format.</Link>
        </>
    );
};
