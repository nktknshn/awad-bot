import { parseTagsLambda as parseTags, parseCard } from './parsing'


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


const card1 = `diligence
#noun #gaming
`

test('parseCard', () => {
    expect(parseCard(card1)).toEqual(
        { word: 'diligence', tags: [ '#noun', '#gaming' ], meanings: [] })
})