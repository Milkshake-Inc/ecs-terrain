import { useQueries, useState } from '@ecs/core/helpers';
import TickerEngine from '@ecs/core/TickerEngine';
import Transform from '@ecs/plugins/math/Transform';
import RenderSystem from '@ecs/plugins/render/3d/systems/RenderSystem';
import { InputSystem } from '@ecs/plugins/input/systems/InputSystem';
import SoundSystem from '@ecs/plugins/sound/systems/SoundSystem';
import ThirdPersonCameraSystem from '@ecs/plugins/render/3d/systems/ThirdPersonCameraSystem';
import PhysXPhysicsSystem from '@ecs/plugins/physics/physx/PhysXPhysicsSystem';
import { generateGradientSkybox } from '@ecs/plugins/render/3d/prefabs/GradientSkybox';
import { AmbientLight, Color as ThreeColor, DirectionalLight, PerspectiveCamera } from 'three';
import { LoadGLTF } from '@ecs/plugins/tools/ThreeHelper';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { Entity } from 'tick-knock';
import Color from '@ecs/plugins/math/Color';
import { getCharacter, MovementSystem } from './Character';
import { Terrain } from './terrain/Terrain';
import ChunkViewer from './chunk/components/ChunkViewer';
import Mouse from '@ecs/plugins/input/Mouse';
import { getWater } from './Water';
import { getHelicopter, HelicopterControllerSystem, Vehicle } from './Helicopter';
import SoundListener from '@ecs/plugins/sound/components/SoundListener';

export class Engine extends TickerEngine {
	constructor(heliModel: GLTF) {
		super();

		this.addSystem(new RenderSystem());
		this.addSystem(new PhysXPhysicsSystem({ x: 0, y: -7, z: 0 }));
		this.addSystem(new MovementSystem());
		this.addSystem(new HelicopterControllerSystem());
		this.addSystem(new InputSystem());
		this.addSystem(new SoundSystem());
		this.addSystem(
			new ThirdPersonCameraSystem({
				value: 10,
				min: 5,
				max: 50,
				speed: 1
			})
		);

		const light = new Entity();
		light.add(Transform, { x: 3 });
		light.add(new DirectionalLight(new ThreeColor(Color.White), 1));
		light.add(new AmbientLight(new ThreeColor(Color.White), 0.4));

		const camera = new Entity();
		camera.add(Transform);
		camera.add(ChunkViewer);
		camera.add(PerspectiveCamera);
		camera.add(SoundListener);

		const spaces = new Entity();
		spaces.add(new Terrain(this, true));

		const heli = getHelicopter(heliModel, undefined, 'helicopter.mp3');

		this.addEntities(light, generateGradientSkybox(1999), camera, heli, getWater(), spaces);
	}

	update(dt: number, fd: number) {
		super.update(dt, fd);
		Mouse.startPointerLock();
	}
}

LoadGLTF('heli.glb').then(gltf => {
	new Engine(gltf);
});
