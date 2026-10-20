export const ID_GENERATOR = Symbol('ID_GENERATOR');

export interface IdGeneratorPort {
  generate(): string;
}
