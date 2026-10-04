import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Character } from '../Character';
import { CharacterManager } from '../CharacterManager';
import { CharacterModel, type CharacterController } from './CharacterModel';
import { ModelRegistry } from './ModelRegistry';
import { AGENT_SPAWN_DEFS } from './roster';
import { GridMap } from '../../navigation/GridMap';
import { AStarPathfinder } from '../../navigation/AStarPathfinder';
import { SlotReservationManager } from '../../navigation/SlotReservationManager';
import { Choreographer } from '../Choreographer';
import { officeStore } from '../../store/officeStore';
import type { InteractionSlot } from '../types';
import { gridToScreen } from '../projection';
import { VitalsModel } from './VitalsModel';
import { EasterEggModel } from './EasterEggModel';
import { getFreshMockSnapshot } from '../../mocks/fixtures';
import type { CollectiveKind } from '../../types/office';

function createRegistry(pure: boolean, grid: GridMap) {
  if(pure) return new ModelRegistry(grid);
  const registry=new CharacterManager();
  for(const def of AGENT_SPAWN_DEFS) {
    const slot=grid.getSlot(def.defaultSlotId);
    const char=new Character({...def,initialGx:slot?.gx??def.fallbackGx,initialGy:slot?.gy??def.fallbackGy,initialFacing:slot?.facing??def.fallbackFacing});
    if(slot) char.act({...slot,worldPos:gridToScreen(slot.gx,slot.gy)} as InteractionSlot);
    registry.addCharacter(char);
  }
  return registry;
}

const map = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/maps/floor1.tmj'), 'utf8'));
function snapshot(char: CharacterController) {
  return { id: char.id, gx: char.gx, gy: char.gy, x: char.x, y: char.y, z: char.zIndex, fsm: char.fsmState,
    facing: char.facing, anim: char.getCurrentAnimation(), slot: char.getCurrentSlot()?.id, offset: char.slotYOffset,
    work: char.workStatus, visible: char.visible, fail: char.isShowingFailStamp, parcel: char.isCarryingParcel };
}
afterEach(() => {officeStore.getState().reset();vi.restoreAllMocks();});

describe('Renderer-independent simulation parity', () => {
  it('matches legacy motion/FSM on a turning route, slot arrival, work gesture and leave', () => {
    const legacy = new Character({ id:'prism', name:'Prism', initialGx:3, initialGy:8 });
    const model = new CharacterModel({ id:'prism', name:'Prism', initialGx:3, initialGy:8 });
    const grid = new GridMap(map);
    const rawSlot = grid.getSlot('slot_z08_desk_prism')!;
    const slot = {...rawSlot,worldPos:gridToScreen(rawSlot.gx,rawSlot.gy)} as InteractionSlot;
    const route = new AStarPathfinder(grid).findPath({gx:3,gy:8},{gx:slot.gx,gy:slot.gy})!;
    expect(route.length).toBeGreaterThan(5);
    const transitions = [[],[]] as string[][];
    [legacy,model].forEach((char,i) => {
      char.onStateChange = (a,b) => transitions[i].push(`${a}>${b}`);
      char.walk(route,slot);
    });
    for(let i=0;i<800;i++) {
      legacy.update(.025); model.update(.025);
      expect(snapshot(model)).toEqual(snapshot(legacy));
    }
    expect(model.fsmState).toBe('act');
    for (const char of [legacy,model]) char.setWorkStatus('working',{id:'qa_real_task',title:'QA',board:'local-qa',status:'running'});
    for(let i=0;i<360;i++) {legacy.update(.025);model.update(.025);expect(snapshot(model)).toEqual(snapshot(legacy));}
    for(const char of [legacy,model]) {char.showFailStamp(1);char.setCarryingParcel(true);char.leave();char.update(1.1);}
    expect(snapshot(model)).toEqual(snapshot(legacy));
    expect(transitions[1]).toEqual(transitions[0]);
    legacy.destroy({children:true});
  });

  it('gait counts the full distance across turns in one frame', () => {
    const char = new CharacterModel({id:'qa',name:'QA',speed:4});
    char.walk([{gx:0,gy:0},{gx:1,gy:0},{gx:1,gy:1},{gx:0,gy:1},{gx:0,gy:0}]);
    char.update(1);
    expect(char.travelDistance).toBeCloseTo(4);
    expect([char.gx,char.gy]).toEqual([0,0]);
  });

  it('matches a seeded 17-character legacy choreography trace without running both owners together', () => {
    function run(pure: boolean) {
      officeStore.getState().reset();
      officeStore.getState().setHonestMode(false);
      const grid = new GridMap(map), slots = new SlotReservationManager(grid);
      const registry = pure ? new ModelRegistry(grid) : new CharacterManager();
      if (registry instanceof CharacterManager) for(const def of AGENT_SPAWN_DEFS) {
        const slot = grid.getSlot(def.defaultSlotId)!;
        const char = new Character({...def,initialGx:slot?.gx??def.fallbackGx,initialGy:slot?.gy??def.fallbackGy,initialFacing:slot?.facing??def.fallbackFacing});
        if(slot) char.act({...slot,worldPos:gridToScreen(slot.gx,slot.gy)} as InteractionSlot);
        registry.addCharacter(char);
      }
      let seed=42;
      const randomFn = () => {seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
      const choreo = new Choreographer({characterManager:registry,gridMap:grid,pathfinder:new AStarPathfinder(grid),slotManager:slots,randomFn});
      choreo.init();
      const trace = [];
      for(let i=0;i<600;i++) {
        if(i===150) officeStore.getState().setHonestMode(true);
        if(i===250) {officeStore.getState().setFounderAuthenticated(true);choreo.handleFloorClick(13,23);}
        if(i===400) choreo.handleAgentClick('oracle');
        choreo.update(.05);registry.update(.05);
        if(i%10===0) trace.push(registry.getAllCharacters().map(snapshot));
      }
      choreo.destroy();registry.destroy();
      return trace;
    }
    expect(run(true)).toEqual(run(false));
  });

  it('CPU requires 60 uninterrupted seconds; stale clears CPU/RAM/disk effects', () => {
    officeStore.getState().reset();
    const grid=new GridMap(map), registry=new ModelRegistry(grid);
    const choreo=new Choreographer({characterManager:registry,gridMap:grid,pathfinder:new AStarPathfinder(grid),slotManager:new SlotReservationManager(grid)});
    choreo.init();
    const vitals=new VitalsModel(registry,choreo);
    vitals.update(0,{cpu_percent:81,memory_percent:86,disk_percent:86,status:'warning'},59);
    expect(vitals.isCpuAlertActive()).toBe(false);
    vitals.update(0,{cpu_percent:81,memory_percent:86,disk_percent:86,status:'warning'},1);
    expect([vitals.isCpuAlertActive(),vitals.isRamAlertActive(),vitals.isDiskAlertActive(),vitals.isBastionSweating()]).toEqual([true,true,true,true]);
    vitals.markStale();
    expect([vitals.isCpuAlertActive(),vitals.isRamAlertActive(),vitals.isDiskAlertActive()]).toEqual([false,false,false]);
    expect(vitals.cpuHighDuration).toBe(0);
    vitals.destroy();choreo.destroy();registry.destroy();
  });
  it('retains Easter egg timers, Friday/WIB rules and task precedence without DOM/Pixi', () => {
    officeStore.getState().reset();officeStore.getState().setHonestMode(false);
    const grid=new GridMap(map),registry=new ModelRegistry(grid);
    const choreo=new Choreographer({characterManager:registry,gridMap:grid,pathfinder:new AStarPathfinder(grid),slotManager:new SlotReservationManager(grid)});
    choreo.init();
    const eggs=new EasterEggModel(registry,choreo,null,{getNow:()=>new Date('2026-10-04T12:00:00Z'),randomFn:()=>.5});
    for(const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']) eggs.handleKeyDown({key});
    expect(eggs.getState().isKonamiActive).toBe(true);eggs.update(5.1);expect(eggs.getState().isKonamiActive).toBe(false);
    for(let i=0;i<10;i++) eggs.handleOracleClick();
    expect(eggs.confetti.length).toBe(24);eggs.update(4.1);expect(eggs.confetti.length).toBe(0);
    expect(eggs.isNoDeployFriday(new Date('2026-10-02T09:00:00Z'))).toBe(true);
    expect(eggs.isNoDeployFriday(new Date('2026-10-02T08:59:00Z'))).toBe(false);
    expect(eggs.is3AmWib(new Date('2026-10-03T20:00:00Z'))).toBe(true);
    const steward=registry.getCharacter('steward')!;
    steward.setWorkStatus('working',{id:'qa',title:'QA',board:'qa',status:'running'});
    expect(eggs.triggerStewardGlitchRepair()).toBe(false);
    expect(eggs.handleEspressoClick().coffeeCount).toBe(1);
    expect(eggs.handleEspressoClick().coffeeCount).toBe(2);
    eggs.destroy();choreo.destroy();registry.destroy();
  });
  it.each<CollectiveKind>(['rapat','break','sholat','pool_party','fire_drill','town_hall'])('matches legacy collective %s trace with real work priority',kind=>{
    vi.spyOn(Date,'now').mockReturnValue(new Date('2026-10-05T00:00:00Z').getTime());
    function run(pure:boolean) {
      officeStore.getState().reset();officeStore.getState().setHonestMode(false);
      officeStore.getState().applySnapshot(getFreshMockSnapshot());
      const grid=new GridMap(map),registry=createRegistry(pure,grid);
      let seed=42;const randomFn=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
      const choreo=new Choreographer({characterManager:registry,gridMap:grid,pathfinder:new AStarPathfinder(grid),slotManager:new SlotReservationManager(grid),randomFn});
      choreo.init();
      const now=Math.floor(Date.now()/1000);
      officeStore.getState().updateCollective({id:`qa_${kind}`,kind,title:'Local collective QA',started_at:now,expires_at:now+300,participants:AGENT_SPAWN_DEFS.map(d=>d.id),active:true});
      const trace=[];
      for(let i=0;i<400;i++) {choreo.update(.1);registry.update(.1);if(i%10===0)trace.push(registry.getAllCharacters().map(snapshot));}
      expect(registry.getCharacter('forge')?.workStatus).toBe('working');
      expect(choreo.getAgentState('forge')?.currentLayer).toBe('task');
      choreo.destroy();registry.destroy();return trace;
    }
    expect(run(true)).toEqual(run(false));
  });
});
