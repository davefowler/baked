declare global {
    var prompt: ((question: string) => Promise<string>) | undefined;
}

// This prevents TypeScript from treating this as a module
export {}; 