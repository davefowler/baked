import path from 'path';

export const isValidPath = (filePath: string): boolean => {
    // Normalize the path to resolve any . or .. segments
    const normalizedPath = path.normalize(filePath);
    
    // Check if the path contains any directory traversal attempts
    if (normalizedPath.includes('..')) {
        return false;
    }
    
    // Check for absolute paths
    if (path.isAbsolute(normalizedPath)) {
        return false;
    }
    
    // Optional: Add additional checks for allowed characters/patterns
    const validPathPattern = /^[a-zA-Z0-9-_/]+\.[a-zA-Z0-9]+$/;
    return validPathPattern.test(filePath);
}
