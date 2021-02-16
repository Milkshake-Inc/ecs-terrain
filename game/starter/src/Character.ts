import { useQueries, useState } from '@ecs/core/helpers';
import Input from '@ecs/plugins/input/components/Input';
import { Controls, KeySet } from '@ecs/plugins/input/Control';
import Keyboard from '@ecs/plugins/input/Keyboard';
import Transform from '@ecs/plugins/math/Transform';
import Vector3 from '@ecs/plugins/math/Vector';
import { PhysXBody } from '@ecs/plugins/physics/physx/component/PhysXBody';
import { PhysXBox } from '@ecs/plugins/physics/physx/component/shapes/PhysXBox';
import { PxRidgidBodyFlags } from '@ecs/plugins/physics/physx/PxRidgidBodyFlags';
import ThirdPersonTarget from '@ecs/plugins/render/3d/systems/ThirdPersonTarget';
import { BoxGeometry, Mesh, MeshPhongMaterial, PerspectiveCamera } from 'three';
import { all, Entity, System } from 'tick-knock';
import { CollisionFlags } from './CollisionFlags';

export const getCharacter = (pos = { x: -170, y: 2, z: -100 }, size = 0.1) => {
	const character = new Entity();
	character.add(Transform, pos);
	character.add(Movement);
	character.add(ThirdPersonTarget);
	character.add(PhysXBody, {
		bodyFlags: PxRidgidBodyFlags.eENABLE_CCD,
		mass: 1
	});
	character.add(new Mesh(new BoxGeometry(size * 2, size * 2, size * 2), new MeshPhongMaterial()));
	character.add(PhysXBox, {
		size: { x: size, y: size, z: size },
		restitution: 0.2,
		dynamicFriction: 0.25,
		staticFriction: 0,
		collisionId: CollisionFlags.PLAYER,
		collisionMask: CollisionFlags.WORLD
	});

	return character;
};

export class Movement {
	speed = 0.5;
}

const PlayerInputs = {
	move: Controls.or(Keyboard.direction(KeySet.WASD), Keyboard.direction(KeySet.Arrows))
};

export class MovementSystem extends System {
	inputs = useState(this, new Input(PlayerInputs));

	queries = useQueries(this, {
		movement: all(Movement, Transform),
		cam: all(PerspectiveCamera, Transform)
	});

	update(deltaTime: number) {
		const cam = this.queries.cam.first;
		if (!cam) return;

		this.queries.movement.forEach(entity => {
			const { speed } = entity.get(Movement);

			if (this.inputs.state.move.down) {
				const { body } = entity.get(PhysXBody);

				const input = new Vector3(this.inputs.state.move.x, 0, this.inputs.state.move.y);
				const directionVector = cam.get(Transform).look(input).projectOnPlane(Vector3.UP).normalize();
				body.addImpulseAtLocalPos(directionVector.multi(speed), { x: 0, y: 0, z: 0 });
			}
		});
	}
}
