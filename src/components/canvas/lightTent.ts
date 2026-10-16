import * as THREE from "three";

/**
 * The light a diamond is judged in: a ring of soft panels overhead with the viewer's head dark in the middle, and dark
 * contrast cards round the sides. A stone lit by one even white panel shows a blank white top; it's the dark against
 * the light that gives a brilliant its pattern of bright and dark arrows, and lets its flashes of colour (fire) show.
 */
export function addLightTent(scene: THREE.Object3D, brightness: number) {
  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(brightness), side: THREE.DoubleSide });
  const dark = new THREE.MeshBasicMaterial({ color: 0x1c1c1c, side: THREE.DoubleSide });
  // overhead: eight panels in a ring
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), light);
    p.rotation.x = Math.PI / 2; p.rotation.z = a;
    p.position.set(Math.cos(a) * 5.2, 9, Math.sin(a) * 5.2);
    scene.add(p);
  }
  // the viewer, straight above, blocks the light there
  const head = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), dark);
  head.rotation.x = Math.PI / 2; head.position.y = 8.9;
  scene.add(head);
  // dark cards round the sides, between the room's lights
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 5), dark);
    card.position.set(Math.cos(a) * 9, 3, Math.sin(a) * 9);
    card.lookAt(0, 3, 0);
    scene.add(card);
  }
}
