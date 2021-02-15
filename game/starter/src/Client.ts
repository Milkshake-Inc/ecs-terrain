import(`@ecs/plugins/physics/physx/build/physx.release.js`).then(PhysXModule => {
	PhysXModule.default().then(PhysX => {
		(global as any).PhysX = PhysX;
		require('./Engine.ts');
	});
});
