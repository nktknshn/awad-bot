import { parseTagsLambda as parseTags, parseCard, parseMeanings, parseTranscription, parseCardUpdate } from './parsing'
import { Card } from './interfaces'


test('parseTags', () => {

    const message = `
asd asd ads
#tag1 #tag2
#tag3
asd
sad
#tag4 asdasdasd asds #tag5
`
    expect(
        parseTags(message.split('\n'))
    ).toEqual(['#tag1', '#tag2', '#tag3', '#tag4', '#tag5'])


    //testing corner cases

    expect(
        parseTags(''.split('\n'))
    ).toEqual([])


    expect(
        parseTags(`
asd asd
asd a

a

asf
`.split('\n'))
    ).toEqual([])
})


const card1 = `- diligence
#noun #gaming
/ˈdi-lə-jən(t)s/

= careful and persistent work or effort.
- The new guy is very creative but I think he needs to develop the virtue of diligence

= the quality of working carefully and with a lot of effort
- She hoped that her diligence would be noticed at work.
- The exhibition has been researched with extraordinary diligence.

`

test('parseCard', () => {
    expect(parseCard(card1)).toEqual(
        {

            word: 'diligence',
            transcription: '/ˈdi-lə-jən(t)s/',
            tags: ['#noun', '#gaming'],
            meanings: [
                {
                    description: 'careful and persistent work or effort.',
                    examples: [
                        'The new guy is very creative but I think he needs to develop the virtue of diligence'
                    ]
                },
                {
                    description: 'the quality of working carefully and with a lot of effort',
                    examples: [
                        'She hoped that her diligence would be noticed at work.',
                        'The exhibition has been researched with extraordinary diligence.'
                    ]
                }
            ]
        } as Card)
})


test('parseMeanings', () => {
    expect(
        parseMeanings(`diligence
The exhibition has been researched with extraordinary diligence.
noun #gaming
= blah blah
`.split('\n'))
    ).toEqual([
        { description: 'blah blah', examples: [] }
    ])

    expect(
        parseMeanings(`diligence
#noun #gaming
= blah blah
- 1

= abc
- 2
- 3

= c
sdf
- 4
-5
`.split('\n'))
    ).toEqual([
        { description: 'blah blah', examples: ['1'] },
        { description: 'abc', examples: ['2', '3'] },
        { description: 'c', examples: ['4', '5'] },
    ])
})

test('parseCardUpdate', () => {
    const result = parseCardUpdate(
        [
            `brittleness`,
            `= A material is brittle if, when subjected to stress, it breaks with little elastic deformation and without significant plastic deformation`,
            `- the brittleness of building web pass`,
            `#tag1 #tag3`,
            `= the quality of being brittle`
        ].join('\n')
    )

    console.log(JSON.stringify(result, undefined, 2));
    
})