import { Synthesizer } from "@axon-generator-toolbox/core/dist/index.js";
import arrayBufferToBuffer from "arraybuffer-to-buffer";

export default (config, options) => {
    const synthesizer = new Synthesizer(config);
    synthesizer.draw("none", "pipes", "all", options.resolution, 0, false);
    const result = synthesizer.toPLY(options.exportBinary, options.exportSimple);
    if (options.exportBinary) return arrayBufferToBuffer(result);
    return result;
};
