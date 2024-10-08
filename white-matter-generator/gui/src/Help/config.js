import Help from "./Help";

import Setup from "./Setup";
import AfterSetup from "./AfterSetup";
import Visual from "./Visual";
import Cli from "./Cli";

export default {
    title: "Help",
    path: "/help",
    component: Help,
    items: [
        {
            title: "Setup",
            path: "/setup",
            component: Setup
        },
        {
            title: "After setup",
            path: "/after_setup",
            component: AfterSetup
        },
        {
            title: "Visual",
            path: "/visual",
            component: Visual
        },
        {
            title: "CLI",
            path: "/cli",
            component: Cli
        }
    ]
};
