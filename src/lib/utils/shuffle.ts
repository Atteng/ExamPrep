/**
 * Performs a Fisher-Yates shuffle on an array.
 * This is an unbiased shuffling algorithm.
 * 
 * @param array The array to shuffle
 * @returns A new shuffled array (does not mutate original)
 */
export function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}
