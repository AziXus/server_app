import {SocketConfig} from '../../src/conf/config.js'
import {DebateManager} from "../../src/debatemanager.js";
import io from 'socket.io-client'
import chai from 'chai';
import {DebateConfig} from "../../src/conf/config.js";

const expect = chai.expect;
const should = chai.should();

const SERVER_ADDRESS = `http://localhost:${SocketConfig.SOCKET_PORT}`;
const PRIVILEGED_NAMESPACE = `${SERVER_ADDRESS}${SocketConfig.PRIVILEGED_NAMESPACE}`;
const DEBATE_NAMESPACE = `${SERVER_ADDRESS}${SocketConfig.DEBATE_NAMESPACE_PREFIX}`;

describe("Debate client functions", () => {
    let debateManager;
    let admin;
    let client;
    let id;
    let debate;

    before(async () => {
        debateManager = new DebateManager();
        await debateManager.start();

        admin = io.connect(`${PRIVILEGED_NAMESPACE}`, {
            path: SocketConfig.DEFAULT_PATH,
            forceNew: true,
            query: {
                password: `${SocketConfig.ADMIN_PASSWORD}`,
                username: `admin`
            }
        });

        let debateInfo = {
            title: 'My new debate',
            description: 'Test debate'
        };

        await new Promise(resolve => {
            admin.emit("newDebate", debateInfo, (debateID) => {
                id = debateID;
                resolve();
            });
        });
    });

    beforeEach((done) => {
        debate = debateManager.nspAdmin.getActiveDebate(id);

        client = io.connect(`${DEBATE_NAMESPACE}${id}`, {
            path: SocketConfig.DEFAULT_PATH,
            forceNew: true,
            query: {
                uuid: '2345675432'
            }
        });

        client.on('connect', () => {
            done();
        });
    });

    describe('getDebateDetails', () => {
        it('should send id, title and description', (done) => {
            client.emit('getDebateDetails', (details) => {
                details.debateId.should.equal(id);
                details.title.should.equal('My new debate');
                details.description.should.equal('Test debate');
                done();
            });
        });
    });

    describe('getQuestions', () => {
        it('should send empty array', (done) => {
            client.emit('getQuestions', (questions) => {
                questions.length.should.equal(0);
                done();
            });
        });

        it('should send questions array', async () => {
            const NB_QUESTIONS = 3;
            for (let i = 0; i < NB_QUESTIONS; ++i)
                await debate.sendNewQuestion(new debate.Question(`Question${i}`, ['...']));

            await new Promise(resolve => {
                client.emit('getQuestions', (questions) => {
                    questions.length.should.equal(NB_QUESTIONS);
                    for (let i = 0; i < questions.length; ++i)
                        questions[i].title.should.equal(`Question${i}`);

                    resolve();
                });
            });
        });
    });

    describe('newQuestion', () => {
        it('should receive question', (done) => {
            client.on('newQuestion', (questionObj) => {
                questionObj.title.should.equal('Does this test work ?');
                questionObj.answers[0].should.equal('Yes');
                questionObj.answers[1].should.equal('No');
                done();
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', ['Yes', 'No']));
        });

        it('should receive open question', (done) => {
            client.on('newQuestion', (questionObj) => {
                questionObj.title.should.equal('Does this test work ?');
                questionObj.answers.length.should.equal(0);
                questionObj.isOpenQuestion.should.equal(true);
                done();
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', null, true));
        });
    });

    describe('answerQuestion', () => {
        it('should answer question', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerQuestion', {questionId : questionObj.id, answerId : 0}, (res) => {
                    res.should.equal(true);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', ['Yes', 'No']));
        });

        it('should not answer open question', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerQuestion', {questionId : questionObj.id, answerId : 0}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', null, true));
        });

        it('should not answer twice', (done) => {
            client.on('newQuestion', async (questionObj) => {
                await new Promise(resolve => {
                    client.emit('answerQuestion', {questionId: questionObj.id, answerId: 0}, (res) => {
                        res.should.equal(true);
                        resolve();
                    });
                });

                client.emit('answerQuestion', {questionId: questionObj.id, answerId: 0}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', ['Yes', 'No']));
        });

        it('should not work with invalid questionId', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerQuestion', {questionId : -1, answerId : 1}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', ['Yes', 'No']));
        });

        it('should not work with invalid object', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerQuestion', {myFieldIsInvalid: 12}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', ['Yes', 'No']));
        });
    });

    describe('answerOpenQuestion', () => {
        it('should answer open question', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerOpenQuestion', {questionId : questionObj.id, answer : 'Hopefully, yes'}, (res) => {
                    res.should.equal(true);

                    let question = debate.questions.get(questionObj.id);
                    question.answers[0].answer.should.equal('Hopefully, yes');
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', null, true));
        });

        it('should not answer closed question', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerOpenQuestion', {questionId : questionObj.id, answer : 'Hopefully, yes'}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', ['Yes', 'No']));
        });

        it('should not answer twice', (done) => {
            client.on('newQuestion', async (questionObj) => {
                await new Promise(resolve => {
                    client.emit('answerOpenQuestion', {questionId : questionObj.id, answer : 'Hopefully, yes'}, (res) => {
                        res.should.equal(true);
                        resolve();
                    });
                });

                client.emit('answerOpenQuestion', {questionId : questionObj.id, answer : 'Hopefully, yes'}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', null, true));
        });

        it('should not work with invalid questionId', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerOpenQuestion', {questionId : -1, answer : 'Hey'}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', null, true));
        });

        it('should not work with invalid object', (done) => {
            client.on('newQuestion', (questionObj) => {
                client.emit('answerOpenQuestion', {myFieldIsInvalid: 12}, (res) => {
                    res.should.equal(false);
                    done();
                });
            });

            debate.sendNewQuestion(new debate.Question('Does this test work ?', null, true));
        });
    });

    describe('getSuggestedQuestions', () => {
        it('should return empty array', (done) => {
            client.emit('getSuggestedQuestions', (suggestions) => {
                suggestions.length.should.equal(0);
                done();
            });
        });

        it('should return one suggestion', async () => {
            await new Promise(resolve => {
                client.emit('suggestQuestion', 'This is my suggestion', res => {
                    res.should.not.equal(false);
                    resolve();
                });
            });

            await new Promise(resolve => {
                client.emit('getSuggestedQuestions', (suggestions) => {
                    suggestions.length.should.equal(1);
                    resolve();
                });
            });
        });
    });

    describe('suggestQuestion', () => {
        it('should accept a valid suggestion', (done) => {
            client.emit('suggestQuestion', 'This is my suggestion', res => {
                res.should.not.equal(false);
                done();
            });
        });

        it('should not make unlimited suggestions', async () => {
            // Connect a new client for an unique uuid
            let uniqueClient = io.connect(`${DEBATE_NAMESPACE}${id}`, {
                path: SocketConfig.DEFAULT_PATH,
                forceNew: true,
                query: {
                    uuid: '2143erdv32ew'
                }
            });
            await new Promise(resolve => uniqueClient.on('connect', resolve));

            // Generate the max number of suggestions
            let promises = [];
            for (let i = 0; i < DebateConfig.MAX_SUGGESTIONS; ++i) {
                promises.push(new Promise(resolve => {
                    uniqueClient.emit('suggestQuestion', `Suggestion${i}`, res => {
                        res.should.not.equal(false);
                        resolve();
                    });
                }));
            }
            await Promise.all(promises);

            await new Promise(resolve => {
                uniqueClient.emit('suggestQuestion', `My last of too many suggestions`, res => {
                    res.should.equal(false);
                    resolve();
                });
            });

            uniqueClient.close();
        });

        it('should not accept suggestion with too many chars', (done) => {
            let suggestion = 'a'.repeat(255);
            client.emit('suggestQuestion', suggestion, res => {
                res.should.equal(false);
                done();
            });
        });

        it('should emit suggestion once approved', (done) => {
            let suggestionText = 'This is my personal suggestion.'
            client.on('suggestedQuestion', (suggestionObj) => {
                let {id, suggestion, votes} = suggestionObj

                suggestion.should.equal(suggestionText);
                votes.should.equal(1);
                done();
            });

            client.emit('suggestQuestion', suggestionText, res => {
                res.should.not.equal(false);
            });
        });
    });

    describe('voteSuggestedQuestion', () => {
        let votingClient;
        let suggestion;
        let suggestionId;

        before((done) => {
            votingClient = io.connect(`${DEBATE_NAMESPACE}${id}`, {
                path: SocketConfig.DEFAULT_PATH,
                forceNew: true,
                query: {
                    uuid: '2345671312325432'
                }
            });

            votingClient.on('connect', done);
        });

        beforeEach((done) => {
            client.on('suggestedQuestion', (suggestionObj) => {
                suggestionId = suggestionObj.suggestionId;
                suggestion = debate.questionSuggestion.approvedSuggestedQuestions.get(suggestionId);
                done();
            });

            client.emit('suggestQuestion', 'This is my new suggestion.', res => {
                res.should.not.equal(false);
            });
        });

        it('should be able to vote', (done) => {
            votingClient.emit('voteSuggestedQuestion', suggestionId, res => {
                res.should.equal(true);
                suggestion.getNbVotes().should.equal(2);
                done();
            });
        });

        it('should not vote twice', async () => {
            await new Promise(resolve => {
                votingClient.emit('voteSuggestedQuestion', suggestionId, res => {
                    res.should.equal(true);
                    suggestion.getNbVotes().should.equal(2);
                    resolve();
                });
            });

            await new Promise(resolve => {
                votingClient.emit('voteSuggestedQuestion', suggestionId, res => {
                    res.should.equal(false);
                    suggestion.getNbVotes().should.equal(2);
                    resolve();
                });
            });
        });

        it('should not vote with an invalid suggestion id', (done) => {
            votingClient.emit('voteSuggestedQuestion', -1, (res) => {
                res.should.equal(false);
                done();
            });
        });

        after(() => {
            votingClient.close();
        });
    });

    afterEach(() => {
        client.close();
    });

    after(() => {
        admin.close();
        debateManager.stop();
    });
});
