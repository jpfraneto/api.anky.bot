function daysBetweenDates(start: number, end: number) {
    const oneDay = 24 * 60 * 60 * 1000; // Hours, minutes, seconds, milliseconds
    return Math.round((end - start) / oneDay);
}

export function getAnkyverseDay(date: number) {
    // the exact moment when the ankyverse started
    const ankyverseStart = new Date("2023-08-10T05:00:00-04:00").getTime();
    const daysInSojourn = 96;
    const daysInSlumber = 21;
    const cycleLength = daysInSojourn + daysInSlumber; // 117 days
    const kingdoms = [
        "Primordia",
        "Emblazion",
        "Chryseos",
        "Eleasis",
        "Voxlumis",
        "Insightia",
        "Claridium",
        "Poiesis",
    ];

    const elapsedDays = daysBetweenDates(ankyverseStart, date);
    const currentSojourn = Math.floor(elapsedDays / cycleLength) + 1;
    const dayWithinCurrentCycle = elapsedDays % cycleLength;

    let currentKingdom, status, wink;
    if (dayWithinCurrentCycle < daysInSojourn) {
        status = "sojourn";
        wink = dayWithinCurrentCycle + 1; // Wink starts from 1
        currentKingdom = kingdoms[dayWithinCurrentCycle % 8];
    } else {
        status = "great slumber";
        wink = null; // no wink during the great slumber
        currentKingdom = "none";
    }
    return {
        timestamp: date.toString(),
        sojourn: currentSojourn,
        wink,
        cycle: status,
        kingdom: currentKingdom,
        chronologicalDay: elapsedDays
    };
}

export const sleep = (ms = 0) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export function getStartOfDay(timestamp: number): number {
    const startTimestamp = 1711861200 * 1000; // Convert to milliseconds
    const startDate = new Date(startTimestamp);
  
    const timeDifference = timestamp - startDate.getTime(); // Difference in milliseconds
    const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
  
    return daysDifference;
  }