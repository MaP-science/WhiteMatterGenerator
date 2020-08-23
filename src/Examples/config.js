import Examples from "./Examples";

import GettingStarted from "./GettingStarted";
import Input from "./Input";
import ParallelSameSize from "./ParallelSameSize";

export default {
    title: "Examples",
    path: "/examples",
    component: Examples,
    items: [
        {
            title: "Getting started",
            path: "/getting_started",
            component: GettingStarted
        },
        {
            title: "Input file",
            path: "/input",
            component: Input
        },
        {
            title: "Parallel axons of equal size",
            path: "/parallelSameSize",
            component: ParallelSameSize
        }
    ]
};
