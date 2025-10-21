export type RandomSource = () => number;
export type Clock = () => number;

let activeRandom: RandomSource = Math.random;
let activeClock: Clock = () => Date.now();

export function getRandomSource(): RandomSource {
  return activeRandom;
}

export function setRandomSource(source: RandomSource): void {
  activeRandom = source;
}

export function getClock(): Clock {
  return activeClock;
}

export function setClock(clock: Clock): void {
  activeClock = clock;
}

export function random(): number {
  return activeRandom();
}

export function now(): number {
  return activeClock();
}
