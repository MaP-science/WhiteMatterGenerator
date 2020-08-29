import {
    Vector3,
    MeshPhongMaterial,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    Mesh,
    SphereBufferGeometry,
    BufferAttribute,
    VertexColors,
    DoubleSide,
    Geometry,
    Face3
} from "three";

import Ellipsoid from "./ellipsoid";

const computeCollisionTree = (ellipsoids, minDist) => {
    if (ellipsoids.length === 1)
        return {
            ellipsoid: ellipsoids[0],
            aabb: ellipsoids[0].boundingBox(minDist),
            containsPoint: p => ellipsoids[0].containsPoint(p)
        };
    const a = computeCollisionTree(ellipsoids.slice(0, Math.ceil(ellipsoids.length / 2)), minDist);
    const b = computeCollisionTree(ellipsoids.slice(Math.ceil(ellipsoids.length / 2)), minDist);
    const aabb = a.aabb.clone().union(b.aabb);
    return {
        a: a,
        b: b,
        aabb: aabb,
        containsPoint: p => {
            if (!aabb.containsPoint(p)) return false;
            return a.containsPoint(p) || b.containsPoint(p);
        }
    };
};

const collision = (a, b, minDist, maxOverlap) => {
    if (!a.aabb.intersectsBox(b.aabb)) return;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.collision(b.ellipsoid, minDist, maxOverlap);
        return collision(b, a, minDist, maxOverlap);
    }
    const f1 = () => collision(b.a, a, minDist, maxOverlap);
    const f2 = () => collision(b.b, a, minDist, maxOverlap);
    if (Math.random() < 0.5) {
        f1();
        f2();
    } else {
        f2();
        f1();
    }
};

const getOverlap = (a, b, minDist, maxOverlap) => {
    if (!a.aabb.intersectsBox(b.aabb)) return 0;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.getOverlap(b.ellipsoid, minDist, maxOverlap);
        return getOverlap(b, a, minDist, maxOverlap);
    }
    return Math.max(getOverlap(b.a, a, minDist, maxOverlap), getOverlap(b.b, a, minDist, maxOverlap));
};

const applyColor = (geometry, color) => {
    if (!geometry?.attributes?.position?.count) return geometry;
    return geometry.setAttribute(
        "color",
        new BufferAttribute(
            new Float32Array(
                Array(geometry.attributes.position.count)
                    .fill([
                        parseInt(color.substr(1, 6).substr(0, 2), 16) / 255,
                        parseInt(color.substr(1, 6).substr(2, 2), 16) / 255,
                        parseInt(color.substr(1, 6).substr(4, 2), 16) / 255
                    ])
                    .flat()
            ),
            3
        )
    );
};

export default class {
    constructor(start, end, radius, deformation, minDiameter, movement, ellipsoidDensity, voxelSize, color) {
        this.start = start.clone();
        this.end = end.clone();
        this.radius = radius;
        const n = Math.max(Math.round(end.clone().sub(start.clone()).length() * ellipsoidDensity), 2);
        this.ellipsoids = new Array(n).fill(true).map(
            (_, i) =>
                new Ellipsoid(
                    start
                        .clone()
                        .multiplyScalar(1 - i / (n - 1))
                        .add(end.clone().multiplyScalar(i / (n - 1))),
                    radius,
                    deformation,
                    minDiameter,
                    movement
                )
        );
        this.voxelSize = voxelSize;
        this.color = color;
    }
    keepInVoxel() {
        this.ellipsoids.forEach(ellipsoid => ellipsoid.keepInVoxel(this.voxelSize));
        [this.ellipsoids[0], this.ellipsoids[this.ellipsoids.length - 1]].forEach(ellipsoid => {
            const ax = Math.abs(ellipsoid.pos.x);
            const ay = Math.abs(ellipsoid.pos.y);
            const az = Math.abs(ellipsoid.pos.z);
            if (ax > ay && ax > az) return (ellipsoid.pos.x *= this.voxelSize / (2 * ax));
            if (ay > az) return (ellipsoid.pos.y *= this.voxelSize / (2 * ay));
            ellipsoid.pos.z *= this.voxelSize / (2 * az);
        });
    }
    computeCollisionTree(minDist) {
        this.collisionTree = computeCollisionTree(this.ellipsoids, minDist);
    }
    collision(axon, minDist, maxOverlap) {
        return collision(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    getOverlap(axon, minDist, maxOverlap) {
        return getOverlap(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    grow(amount) {
        this.ellipsoids.forEach(ellipsoid => ellipsoid.grow(amount));
    }
    contract(amount) {
        for (let i = 1; i + 1 < this.ellipsoids.length; ++i) {
            const c = this.ellipsoids[i + 1].pos
                .clone()
                .add(this.ellipsoids[i - 1].pos)
                .divideScalar(2);
            const d = this.ellipsoids[i + 1].pos.clone().sub(this.ellipsoids[i - 1].pos);
            d.normalize();
            c.sub(this.ellipsoids[i].pos);
            d.multiplyScalar(c.dot(d));
            c.sub(d);
            this.ellipsoids[i].pos.add(d);
            this.ellipsoids[i].pos.add(c.multiplyScalar(amount));
        }
    }
    getSurfacePoint(pos, dir) {
        return this.ellipsoids.reduce((pMax, ellipsoid) => {
            const distMax = pMax.clone().sub(pos).dot(dir);
            const p = ellipsoid.getSurfacePoint(pos, dir);
            if (!p) return pMax;
            const dist = p.clone().sub(pos).dot(dir);
            return dist > distMax ? p : pMax;
        }, pos);
    }
    generatePipe(scene) {
        const num = 32;
        const d = this.ellipsoids[this.ellipsoids.length - 1].pos.clone().sub(this.ellipsoids[0].pos);
        d.normalize();
        const x = new Vector3(1, 0, 0);
        const y = new Vector3(0, 1, 0);
        const cx = d.clone().cross(x);
        const cy = d.clone().cross(y);
        const a = cx.length() > cy.length() ? cx : cy;
        a.normalize();
        const b = d.clone().cross(a).normalize();
        const geom = new Geometry();
        for (let i = 0; i < this.ellipsoids.length - 1; ++i) {
            const p1 = this.ellipsoids[i].pos;
            const p2 = this.ellipsoids[i + 1].pos;
            for (let j = 0; j < num; ++j) {
                const angle1 = (2 * Math.PI * j) / num;
                const angle2 = (2 * Math.PI * (j + 1)) / num;
                const angleAvg = (2 * Math.PI * (j + 0.5)) / num;
                const dir1 = a
                    .clone()
                    .multiplyScalar(Math.cos(angle1))
                    .add(b.clone().multiplyScalar(Math.sin(angle1)));
                const dir2 = a
                    .clone()
                    .multiplyScalar(Math.cos(angle2))
                    .add(b.clone().multiplyScalar(Math.sin(angle2)));
                const dirAvg = a
                    .clone()
                    .multiplyScalar(Math.cos(angleAvg))
                    .add(b.clone().multiplyScalar(Math.sin(angleAvg)));
                const len = geom.vertices.length;
                geom.vertices.push(this.getSurfacePoint(p1, dir1));
                geom.vertices.push(this.getSurfacePoint(p2, dir1));
                geom.vertices.push(this.getSurfacePoint(p1, dir2));
                geom.vertices.push(this.getSurfacePoint(p2, dir2));
                geom.faces.push(new Face3(len, len + 2, len + 1, dirAvg));
                geom.faces.push(new Face3(len + 1, len + 2, len + 3, dirAvg));
            }
            scene.add(
                new Mesh(
                    applyColor(new BufferGeometry().fromGeometry(geom), this.color),
                    new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide })
                )
            );
        }
    }
    generateSkeleton(scene) {
        scene.add(
            new Line(
                applyColor(
                    new BufferGeometry().setFromPoints(this.ellipsoids.map(ellipsoid => ellipsoid.pos)),
                    this.color
                ),
                new LineBasicMaterial({ vertexColors: VertexColors })
            )
        );
    }
    draw(scene) {
        const mesh = new Mesh(
            applyColor(new SphereBufferGeometry(1, 16, 16), this.color),
            new MeshPhongMaterial({ vertexColors: VertexColors })
        );
        this.ellipsoids.forEach(ellipsoid => ellipsoid.draw(scene, mesh));
    }
}
