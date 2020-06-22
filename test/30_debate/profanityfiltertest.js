import {ProfanityFilter} from "../../src/debate/profanityfilter.js";
import chai from 'chai';

const expect = chai.expect;
const should = chai.should();

describe('ProfanityFilter class test', () => {
    it('should return false without profanities', () => {
        const profanityFilter = new ProfanityFilter();
        profanityFilter.isProfane("Hello world!").should.equal(false);
        profanityFilter.isProfane("Hey what's up ?").should.equal(false);
    });

    it('should return true with profanities', () => {
        const profanityFilter = new ProfanityFilter();
        profanityFilter.isProfane("You are an asshole.").should.equal(true);
    });


});
