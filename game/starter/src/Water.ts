import Color from '@ecs/plugins/math/Color';
import Transform from '@ecs/plugins/math/Transform';
import { PhysXBody } from '@ecs/plugins/physics/physx/component/PhysXBody';
import { PhysXPlane } from '@ecs/plugins/physics/physx/component/shapes/PhysXPlane';
import { PhysXTrimesh } from '@ecs/plugins/physics/physx/component/shapes/TrimeshShape';
import { Mesh, MeshPhongMaterial, PlaneGeometry } from 'three';
import { Entity } from 'tick-knock';
import { CollisionFlags } from './CollisionFlags';

export const getWater = (pos = { x: 0, y: 0, z: 0 }, size = 50000) => {
	const water = new Entity();
	water.add(Transform, pos);
	water.get(Transform).rx = -Math.PI / 2;
	water.add(PhysXBody, {
		static: true
	});
	water.add(PhysXTrimesh, {
		restitution: 0.2,
		staticFriction: 0,
		dynamicFriction: 0,
		collisionId: CollisionFlags.WORLD,
		collisionMask: CollisionFlags.PLAYER
	});
	water.add(new Mesh(new PlaneGeometry(size * 2, size * 2, size * 2), new MeshPhongMaterial({ color: Color.Aqua })));

	return water;
};
