import seedrandom from "seedrandom";

let rng = seedrandom("0");

export const setRandomSeed = (seed: number) => {
    rng = seedrandom(String(seed));
};

export default () => rng();
