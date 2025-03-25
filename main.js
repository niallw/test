
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Vector2, Tools, Quaternion, Color3, StandardMaterial, ActionManager, ExecuteCodeAction, PolygonMeshBuilder, RawTexture } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, TextBlock } from '@babylonjs/gui';
import earcut from 'earcut';    //Required for PolygonMeshBuilder
import { HemisphericLight, ArcRotateCamera, Vector3, Scene, Engine} from '@babylonjs/core';
import * as anu from '@jpmorganchase/anu' //import anu, this project is using a local import of babylon js located at ../babylonjs-anu this may not be the latest version and is used for simplicity.
import * as d3 from 'd3';
import data from './pitches.json';

//Grab DOM element where we will attach our canvas. #app is the id assigned to an empty <div> in our index.html 
const app = document.querySelector('#app');
//Create a canvas element and append it to #app div
const canvas = document.createElement('canvas');
app.appendChild(canvas);

//initialize babylon engine, passing in our target canvas element, and create a new scene
const babylonEngine = new Engine(canvas, true)

// //create a scene object using our engine
// const scene = new Scene(babylonEngine)

// //Add lights and a camera
// new HemisphericLight('light1', new Vector3(0, 10, 0), scene)
// const camera = new ArcRotateCamera("Camera", -(Math.PI / 4) * 3, Math.PI / 4, 10, new Vector3(0, 0, 0), scene);
// camera.position = new Vector3(-10, 10, -20)
// camera.attachControl(true)

let scene = pitches(babylonEngine);

export function pitches(engine){

  //Babylon boilerplate
  const scene = new Scene(engine);
  const light = new HemisphericLight('light1', new Vector3(0, 10, -10), scene);
  const camera = new ArcRotateCamera("Camera", 0, 1, 8, new Vector3(3,3,10), scene);
  camera.wheelPrecision = 20;
  camera.minZ = 0;
  camera.attachControl(true);

  const samplePitch = {
    pitch_trajectory: [
      { x: 0, y: 50, z: 6, time: 0 },
      { x: 10, y: 40, z: 5.5, time: 0.1 },
      { x: 20, y: 30, z: 5, time: 0.2 },
      { x: 30, y: 20, z: 4.5, time: 0.3 },
      { x: 40, y: 10, z: 4, time: 0.4 },
      { x: 50, y: 0, z: 3.5, time: 0.5 }
    ],
    pitch_name: "Test"
  };

  //Function to convert the coordinates of the simulated pitches into Babylon coordinates
  function pitchToPoints(pitch) {
    const pitchTrajectory = pitch.pitch_trajectory;
    let points = pitchTrajectory.map(d => new Vector3(d.x / 3.281,  //Convert feet to meters
                                      d.z / 3.281,      //y and z are flipped in the data
                                      d.y / 3.281));
    points.pop();   //Remove the last point in our dataset since the simulation keeps going for one timestep beyond the homeplate
    return points;
  }

  //Calculate the timings needed to stagger the animation of each pitch based on their duration
  let timings = [];
  data.forEach(d => {
    const pitchTrajectory = d.pitch_trajectory;
    const duration = pitchTrajectory[pitchTrajectory.length - 1].time * 1000;
    timings.push({ duration: duration, delay: 0});
  });

  //D3 scale for color coded pitch names
  let scaleC = d3.scaleOrdinal(anu.ordinalChromatic('d310').toColor3());

  //Create our CoT that will hold our meshes
  let CoT = anu.create("cot", "chart");
  let chart = anu.selectName("chart", scene);

  // *****************
  // *** ANIMATION ***
  // *****************
  // Build the data for the tubes
  let mainPoints = [];
  let shadowPoints = [];
  for (const p of data[0].pitch_trajectory){
    mainPoints.push(new Vector3(p.x / 3.281, p.z / 3.281, p.y / 3.281));
  }
  for (const p of data[1].pitch_trajectory){
    shadowPoints.push(new Vector3(p.x / 3.281, p.z / 3.281, p.y / 3.281));
  }
  let frame = 0; // timer
  let DELAY_BUFFER = 50;
  let TUBE_RADIUS = 0.015
  // =================
  // === Connector ===
  // =================
  let connector = anu.create(
    'tube', 'myTube',
    { 
      path: [new Vector3(0, 0, 0), new Vector3(0, 0, 0)],
      radius: 0.5,
      radial_segments: 16,
      closed: false
    }
  );
  let connectorMaterial = new StandardMaterial('box-mat');
  connectorMaterial.diffuseColor = Color3.Red();
  connector.material = connectorMaterial;
  // =================
  // === Main Traj ===
  // =================
  let mainTraj = anu.create(
    'tube', 'myTube',
    { 
      path: [new Vector3(0, 0, 0), new Vector3(0, 0, 0)],
      radius: 0.5,
      radial_segments: 16,
      closed: false
    }
  );
  let mainTrajMaterial = new StandardMaterial('box-mat');
  mainTrajMaterial.diffuseColor = Color3.Blue();
  connector.material = mainTrajMaterial;
  // ===================
  // === Shadow Traj ===
  // ===================
  let shadowTraj = anu.create(
    'tube', 'myTube',
    { 
      path: [new Vector3(0, 0, 0), new Vector3(0, 0, 0)],
      radius: 0.5,
      radial_segments: 16,
      closed: false
    }
  );
  let shadowTrajMaterial = new StandardMaterial('box-mat');
  shadowTrajMaterial.diffuseColor = Color3.Green();
  connector.material = shadowTrajMaterial;

  // === MAIN UPDATE LOOP ===
  scene.onBeforeRenderObservable.add(() => { 
    frame++;

    // start the animation after a delay to give time for the page to load
    if (frame > DELAY_BUFFER){
      let animationIdx = frame - DELAY_BUFFER;
      if (animationIdx < shadowPoints.length-1){        
        // Connector
        connector.dispose();
        connector = anu.create(
            'tube', 'connectorTrajTube',
            { 
              path: [mainPoints[animationIdx], shadowPoints[animationIdx]],
              radius: TUBE_RADIUS,
              radial_segments: 5,
              closed: false
            }
        );
        connectorMaterial = new StandardMaterial('box-mat');
        connectorMaterial.diffuseColor = Color3.Red();
        connector.material = connectorMaterial;
  
        // Main traj
        let temp = mainPoints.slice(0, animationIdx+1);
        temp.unshift(mainPoints[0]); // need to make sure on frame 1 that the list has at least 1 element
        mainTraj.dispose();
        mainTraj = anu.create(
            'tube', 'mainTrajTube',
            { 
              path: temp,
              radius: TUBE_RADIUS,
              radial_segments: 5,
              closed: false
            }
        );
        mainTrajMaterial = new StandardMaterial('box-mat');
        mainTrajMaterial.diffuseColor = Color3.Blue();
        mainTraj.material = mainTrajMaterial;        
        
        // Shadow traj
        temp = shadowPoints.slice(0, animationIdx+1);
        temp.unshift(shadowPoints[0]); // need to make sure on frame 1 that the list has at least 1 element
        shadowTraj.dispose();
        shadowTraj = anu.create(
            'tube', 'shadowTrajTube',
            { 
              path: temp,
              radius: TUBE_RADIUS,
              radial_segments: 5,
              closed: false
            }
        );
        shadowTrajMaterial = new StandardMaterial('box-mat');
        shadowTrajMaterial.diffuseColor = Color3.Green();
        shadowTraj.material = shadowTrajMaterial;  
      }
    }    
  }); 

  //Create a simple virtual environment
  let environmentCoT = anu.create('cot', 'environment');
  let environment = anu.selectName('environment', scene);
  //floor plane
  environment.bind('ground', { width: 27.4, height: 27.4 })
    .material(new StandardMaterial('groundMaterial'))
    .diffuseColor(Color3.FromHexString('#616161'))
    .specularColor(Color3.Black())
    .position(new Vector3(0, 0, 18.4))
    .rotationY(Math.PI / 4)

  return scene;
}

//Render the scene we created
babylonEngine.runRenderLoop(() => {
  scene.render()
})

//Listen for window size changes and resize the scene accordingly 
window.addEventListener("resize", function () {
  babylonEngine.resize();
});


// hide/show the Inspector
window.addEventListener("keydown", (ev) => {
    // Shift+Ctrl+Alt+I
    if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
        if (scene.debugLayer.isVisible()) {
            scene.debugLayer.hide();
        } else {
            scene.debugLayer.show();
        }
    }
});
