import * as THREE from '../ANIMUS Android App/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../ANIMUS Android App/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from '../ANIMUS Android App/node_modules/three/examples/jsm/controls/OrbitControls.js';
export async function mountModel(host,bytes){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0xeae8e3);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.01,10000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.screenSpacePanning=true;
  scene.add(new THREE.HemisphereLight(0xffffff,0x7c8177,2.6));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(4,8,6);scene.add(sun);
  const loader=new GLTFLoader();loader.setCrossOrigin('anonymous');loader.manager.setURLModifier(url=>{if(!url.startsWith('data:')&&!url.startsWith('blob:'))throw Error('External model resources are not permitted.');return url;});
  const gltf=await loader.parseAsync(bytes,'');scene.add(gltf.scene);
  const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(radius)||radius<=0)throw Error('This model has no visible geometry.');
  controls.target.copy(center);const distance=radius*1.9;camera.near=Math.max(radius/1000,.001);camera.far=radius*100;camera.updateProjectionMatrix();
  const reset=(direction=new THREE.Vector3(1,.7,1))=>{camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));controls.target.copy(center);controls.update();};reset();
  host.replaceChildren(renderer.domElement);const tools=document.createElement('div');tools.className='model-tools';
  for(const [label,direction] of [['Reset',[1,.7,1]],['Front',[0,0,1]],['Side',[1,0,0]],['Top',[0,1,.001]]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>reset(new THREE.Vector3(...direction));tools.append(button);}
  const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.textContent='Fullscreen';fullscreen.onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else host.requestFullscreen?.();};tools.append(fullscreen);host.append(tools);
  const resize=()=>{const rect=host.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
  return {dispose(){renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();gltf.scene.traverse(object=>{object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});renderer.dispose();host.replaceChildren();}};
}
