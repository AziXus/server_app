import Filter from 'bad-words'

export class ProfanityFilter {
    filter;

    constructor() {
        this.filter = new Filter();
    }

    isProfane(text) {
        return this.filter.isProfane(text);
    }
}