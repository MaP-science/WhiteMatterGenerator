import seedrandom from "seedrandom";

let rng = seedrandom(0);

export const setRandomSeed = seed => {
    rng = seedrandom(seed);
};

export default () => rng();
