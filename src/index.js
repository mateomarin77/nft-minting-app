import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import store from "./redux/store";
import { Provider } from "react-redux";
import "./styles/reset.css";

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

let el = document.querySelector('.avatar')

    el.addEventListener('mousemove', (e) => {
      let thisPX = el.getBoundingClientRect().left
      let thisPY = el.getBoundingClientRect().top
      let boxWidth = el.getBoundingClientRect().width
      let boxHeight = el.getBoundingClientRect().height
      let scrollTop = document.documentElement.scrollTop + document.body.scrollTop

      let mouseX = e.pageX - thisPX
      let mouseY = e.pageY - scrollTop - thisPY
      let X
      let Y

      X = mouseX - boxWidth / 2
      Y = boxHeight / 2 - mouseY

      el.style.transform = `perspective(300px) rotateY(${X / 10}deg) rotateX(${Y / 10}deg)`
      el.style.boxShadow = `${-X / 20}px ${Y / 20}px 50px rgba(0, 0, 0, 0.3)`
    })


    el.addEventListener('mouseleave', () => {
      el.style.transform = `perspective(300px) rotateY(0deg) rotateX(0deg)`
      el.style.boxShadow = ''
    })



    // Variables
const el1 = document.querySelector(".title");

// Variables ~ Widths
let elWidth = el1.offsetWidth;
let windowWidth = window.innerWidth;

// Variables ~ Mouse
let mouseX = 0;
let prevMouseX = 0;

// Target: value we want to animate to
let skewTarget = 0;
let translateTarget = 0;

// WithEasing: value we use to animate
let skewWithEasing = 0; 
let translateWithEasing = 0;

// EasingFactor: determines how quick the animation/interpolation goes
let skewEasingFactor = 0.1;
let translateEasingFactor = 0.05;

// Events
window.addEventListener("mousemove", handleMouseMove);
window.addEventListener("resize", handleWindowResize);

// Functions
function handleMouseMove(e) {
  mouseX = e.pageX;
}

function handleWindowResize(e) {
  elWidth = el1.offsetWidth;
  windowWidth = window.innerWidth;
}

function lerp(start, end, factor) {
  return (1 - factor) * start + factor * end;
}

function animateMe() {
  // Get difference between current and previous mouse position
  skewTarget = mouseX - prevMouseX;
  prevMouseX = mouseX;
  
  // Calc how much we need to translate our el
  translateTarget = (elWidth - windowWidth) / windowWidth * mouseX * -1;
  
  // Ease between start and target values (skew)
  skewWithEasing = lerp(skewWithEasing, skewTarget, skewEasingFactor);
  
  // Limit our skew to a range of 75 degrees so it doesn't "over-skew"
  skewWithEasing = Math.min(Math.max(parseInt(skewWithEasing), -75), 75);
  
  // Ease between start and target values (translate)
  translateWithEasing = lerp(
    translateWithEasing,
    translateTarget,
    translateEasingFactor
  );

  el1.style.transform = `
    translateX(${translateWithEasing}px)
    skewX(${skewWithEasing}deg)
  `;

  // RAF
  window.requestAnimationFrame(animateMe);
}

window.requestAnimationFrame(animateMe);

