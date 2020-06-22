export class ProfanityFilter {
    isProfane(text) {
        if (text.includes('asshole'))
            return true;
        return false;
    }
}