import fmin from "fmin";

export default (func, start) => fmin.nelderMead(func, start);
