export function getStoreLimits(): {
    textTrainingItemsPerProject: number,
    numberTrainingItemsPerProject: number,
    numberTrainingItemsPerClassProject: number,
    imageTrainingItemsPerProject: number,
} {
    return {
        textTrainingItemsPerProject : 500,
        numberTrainingItemsPerProject : 1000,
        numberTrainingItemsPerClassProject : 3000,
        imageTrainingItemsPerProject : 100,
    };
}
