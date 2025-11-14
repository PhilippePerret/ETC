const isClient = typeof process !== 'undefined';

export const clientSide = !isClient;
export const serverSide = isClient;