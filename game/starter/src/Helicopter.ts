import { useQueries, useSingletonQuery, useState } from '@ecs/core/helpers';
import Transform from '@ecs/plugins/math/Transform';
import Vector3, { Vector } from '@ecs/plugins/math/Vector';
import { PhysXBody } from '@ecs/plugins/physics/physx/component/PhysXBody';
import { PhysXTrimesh } from '@ecs/plugins/physics/physx/component/shapes/TrimeshShape';
import { Euler, Object3D, Quaternion } from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { all, Entity, System } from 'tick-knock';
import { Sound } from '@ecs/plugins/sound/components/Sound';
import SoundFollowTarget from '@ecs/plugins/sound/components/SoundFollowTarget';
import MathHelper from '@ecs/plugins/math/MathHelper';
import { ToThreeVector3, ToVector3 } from '@ecs/plugins/tools/Conversions';
import { PxRidgidBodyFlags } from '@ecs/plugins/physics/physx/PxRidgidBodyFlags';
import { CollisionFlags } from './CollisionFlags';
import { Controls, Key } from '@ecs/plugins/input/Control';
import Keyboard from '@ecs/plugins/input/Keyboard';
import Input from '@ecs/plugins/input/components/Input';
import { PhysXState } from '@ecs/plugins/physics/physx/PhysXPhysicsSystem';
import ThirdPersonTarget from '@ecs/plugins/render/3d/systems/ThirdPersonTarget';
import { PhysXBox } from '@ecs/plugins/physics/physx/component/shapes/PhysXBox';

export class Helicopter {
	constructor(public enginePower: number = 0, public rotors: Object3D[] = []) {}
}

export class Vehicle {
	constructor(public on: boolean = true) {}
}

const getRotorsFromModel = (gltf: GLTF) => {
	const rotors = [];
	gltf.scene.traverse(child => {
		if (child.hasOwnProperty('userData')) {
			if (child.userData.hasOwnProperty('data')) {
				if (child.userData.data === 'rotor') {
					rotors.push(child);
				}
			}
		}
	});

	return rotors;
};

export const getHelicopter = (gltf: GLTF, spawnPosition: Vector = { x: -170, y: 20, z: -100 }, sfx?: string) => {
	const entity = new Entity();

	if (sfx) {
		entity.add(Sound, { src: sfx, loop: true, seek: 0, volume: 2 });
		entity.add(SoundFollowTarget, { offset: new Vector3(0, 0, -5) });
	}
	entity.add(Transform, { position: Vector3.From(spawnPosition) });
	entity.add(Vehicle);
	entity.add(Helicopter, { rotors: getRotorsFromModel(gltf) });
	entity.add(ThirdPersonTarget);
	entity.add(gltf.scene);
	entity.add(PhysXBody, {
		bodyFlags: PxRidgidBodyFlags.eENABLE_CCD,
		mass: 500
	});
	entity.add(PhysXBox, {
		size: { x: 0.5, y: 0.5, z: 0.5 },
		restitution: 0.2,
		dynamicFriction: 0.25,
		staticFriction: 0,
		collisionId: CollisionFlags.PLAYER,
		collisionMask: CollisionFlags.WORLD
	});

	return entity;
};

const HelicopterInputs = {
	left: Controls.or(Keyboard.key(Key.LeftArrow), Keyboard.key(Key.A)),
	right: Controls.or(Keyboard.key(Key.RightArrow), Keyboard.key(Key.D)),
	up: Controls.or(Keyboard.key(Key.W)),
	down: Controls.or(Keyboard.key(Key.S)),
	pitchUp: Controls.or(Keyboard.key(Key.UpArrow)),
	pitchDown: Controls.or(Keyboard.key(Key.DownArrow)),
	yawLeft: Controls.or(Keyboard.key(Key.Q)),
	yawRight: Controls.or(Keyboard.key(Key.E))
};

export class HelicopterControllerSystem extends System {
	protected inputs = useState(this, new Input(HelicopterInputs));

	protected getPhysicsState = useSingletonQuery(this, PhysXState);

	protected queries = useQueries(this, {
		helicopters: all(Vehicle, Helicopter, PhysXBody)
	});

	update(dt: number) {
		this.queries.helicopters.forEach(entity => {
			const heli = entity.get(Helicopter);
			const sound = entity.get(Sound);

			dt = dt / 1000;

			if (entity.get(Vehicle).on) {
				if (heli.enginePower < 1) heli.enginePower += dt * 0.2;
				if (heli.enginePower > 1) heli.enginePower = 1;
			} else {
				if (heli.enginePower > 0) heli.enginePower -= dt * 0.06;
				if (heli.enginePower < 0) heli.enginePower = 0;
			}

			if (sound) {
				sound.rate = heli.enginePower;
			}

			heli.rotors.forEach(r => r.rotateX(heli.enginePower * dt * 30));
		});
	}

	updateFixed(dt: number) {
		this.queries.helicopters.forEach(entity => {
			const { body } = entity.get(PhysXBody);
			const heli = entity.get(Helicopter);
			const transform = entity.get(Transform);
			const physicsState = this.getPhysicsState();

			const bodyVelocity = body.getLinearVelocity();
			const bodyAngularVelocity = body.getAngularVelocity();

			// Up down power
			const verticalFactor = 0.15;

			if (this.inputs.state.up.down) {
				bodyVelocity.x += transform.up.x * heli.enginePower * verticalFactor;
				bodyVelocity.y += transform.up.y * heli.enginePower * verticalFactor;
				bodyVelocity.z += transform.up.z * heli.enginePower * verticalFactor;
			}

			if (this.inputs.state.down.down) {
				bodyVelocity.x -= transform.up.x * heli.enginePower * verticalFactor;
				bodyVelocity.y -= transform.up.y * heli.enginePower * verticalFactor;
				bodyVelocity.z -= transform.up.z * heli.enginePower * verticalFactor;
			}

			// Gravity compensation
			const gravity = physicsState.gravity;
			let gravityCompensation = new Vector3(-gravity.x, -gravity.y, -gravity.z).length();
			gravityCompensation *= physicsState.frameTime;
			gravityCompensation *= 0.098;
			const dot = Vector3.UP.dot(transform.up);
			gravityCompensation *= Math.sqrt(MathHelper.clamp(dot, 0, 1));

			let vertDamping = ToVector3(bodyVelocity).clone();
			vertDamping.x *= transform.up.x;
			vertDamping.y *= transform.up.y;
			vertDamping.z *= transform.up.z;
			vertDamping.multi(-0.01);

			const vertStab = ToVector3(transform.up).clone().multi(gravityCompensation).multi(Math.pow(heli.enginePower, 3)).add(vertDamping);

			bodyVelocity.x += vertStab.x;
			bodyVelocity.y += vertStab.y;
			bodyVelocity.z += vertStab.z;

			if (entity.get(Vehicle).on) {
				const rotStabVelocity = new Quaternion().setFromUnitVectors(ToThreeVector3(transform.up), ToThreeVector3(Vector3.UP));
				rotStabVelocity.x *= 0.3;
				rotStabVelocity.y *= 0.3;
				rotStabVelocity.z *= 0.3;
				rotStabVelocity.w *= 0.3;
				const rotStabEuler = new Euler().setFromQuaternion(rotStabVelocity);

				bodyAngularVelocity.x += rotStabEuler.x;
				bodyAngularVelocity.y += rotStabEuler.y;
				bodyAngularVelocity.z += rotStabEuler.z;
			}

			const angularFactor = 0.05;

			// Pitch
			if (this.inputs.state.pitchDown.down) {
				bodyAngularVelocity.x -= transform.right.x * heli.enginePower * angularFactor;
				bodyAngularVelocity.y -= transform.right.y * heli.enginePower * angularFactor;
				bodyAngularVelocity.z -= transform.right.z * heli.enginePower * angularFactor;
			}
			if (this.inputs.state.pitchUp.down) {
				bodyAngularVelocity.x += transform.right.x * heli.enginePower * angularFactor;
				bodyAngularVelocity.y += transform.right.y * heli.enginePower * angularFactor;
				bodyAngularVelocity.z += transform.right.z * heli.enginePower * angularFactor;
			}

			// Yaw
			if (this.inputs.state.yawLeft.down) {
				bodyAngularVelocity.x += transform.up.x * heli.enginePower * angularFactor;
				bodyAngularVelocity.y += transform.up.y * heli.enginePower * angularFactor;
				bodyAngularVelocity.z += transform.up.z * heli.enginePower * angularFactor;
			}
			if (this.inputs.state.yawRight.down) {
				bodyAngularVelocity.x -= transform.up.x * heli.enginePower * angularFactor;
				bodyAngularVelocity.y -= transform.up.y * heli.enginePower * angularFactor;
				bodyAngularVelocity.z -= transform.up.z * heli.enginePower * angularFactor;
			}

			// Roll
			if (this.inputs.state.right.down) {
				bodyAngularVelocity.x -= transform.forward.x * heli.enginePower * angularFactor;
				bodyAngularVelocity.y -= transform.forward.y * heli.enginePower * angularFactor;
				bodyAngularVelocity.z -= transform.forward.z * heli.enginePower * angularFactor;
			}
			if (this.inputs.state.left.down) {
				bodyAngularVelocity.x += transform.forward.x * heli.enginePower * angularFactor;
				bodyAngularVelocity.y += transform.forward.y * heli.enginePower * angularFactor;
				bodyAngularVelocity.z += transform.forward.z * heli.enginePower * angularFactor;
			}

			// Dampening
			(body as PhysX.RigidDynamic).setAngularDamping(0.97);
			(body as PhysX.RigidDynamic).setLinearDamping(0.5);

			body.setLinearVelocity(bodyVelocity, true);
			body.setAngularVelocity(bodyAngularVelocity, true);
		});
	}
}
