import type { CharacterController } from './CharacterModel';
export interface CharacterRegistry {
  getCharacter(id: string): CharacterController | undefined;
  getAllCharacters(): CharacterController[];
  update(dt: number): void;
}
