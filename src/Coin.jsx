import { useEffect, useRef } from 'react';
import * as THREE from 'three';
export default function Coin() {
  const mount = useRef(null), flip = useRef(-10000);
  useEffect(() => {
    let renderer; try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); } catch { return; }
    renderer.setSize(88, 88); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); mount.current.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .1, 100); camera.position.z = 5;
    scene.add(new THREE.AmbientLight(0xe6c59b, 2)); const light = new THREE.DirectionalLight(0xffdc9a, 4); light.position.set(-3, 4, 5); scene.add(light);
    const coin = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: '#b98d4f', metalness: .75, roughness: .48 });
    const geometry = new THREE.CylinderGeometry(.83, .83, .16, 32); const body = new THREE.Mesh(geometry, mat); body.rotation.x = Math.PI / 2; coin.add(body);
    const rimGeometry = new THREE.TorusGeometry(.72, .025, 4, 32), rim = new THREE.Mesh(rimGeometry, mat); rim.position.z = .095; coin.add(rim);
    const pixelGeometry = new THREE.BoxGeometry(.105, .105, .035); const dark = new THREE.MeshStandardMaterial({ color: '#65462b', roughness: .9 });
    ['01110', '10001', '00010', '00100', '00000', '00100'].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') { const p = new THREE.Mesh(pixelGeometry, dark); p.position.set((x - 2) * .105, (.5 * 5 - y) * .105, .092); coin.add(p); } }));
    scene.add(coin); const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; let frame; const tick = (t) => { const turning = Math.min(1, Math.max(0, (t - flip.current) / 900)); coin.rotation.y = reduce ? .25 : Math.sin(t / 2500) * .6 + turning * Math.PI * 2; coin.rotation.z = -.12; renderer.render(scene, camera); if (!reduce) frame = requestAnimationFrame(tick); }; tick(0);
    return () => { cancelAnimationFrame(frame); geometry.dispose(); rimGeometry.dispose(); pixelGeometry.dispose(); mat.dispose(); dark.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <button ref={mount} className="coin" aria-label="Flip the collectible coin" onClick={() => { flip.current = performance.now(); }}><span aria-hidden="true">?</span></button>;
}
