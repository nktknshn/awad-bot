import { setDoFlush } from "bot5/actions"
import { StoreState } from "bot5/store"
import { flow } from "fp-ts/lib/function"
import { pipe } from "fp-ts/lib/pipeable"
import { Component, connected } from "Lib/component"
import { button, effect, message, messagePart, onCreated, onRemoved, radioRow } from "Libelements-constructors"
import { action, caseText, inputHandler, on } from "Libinput"
import { select } from "Libstate"
import { StoreAction } from "LibstoreF"
import { GetSetState, LocalStateAction } from "Libtree2"

export interface FormData {
    fname?: string,
    lname?: string,
    sex?: 'male' | 'female',
    dob?: string
}

const Input = Component(
    function* ({ }: { title: string }) {

    }
)

const withText = on(caseText, action(({ messageText }) => messageText))

export const Form1 = connected(
    select(),
    function* <R>(
        _: unknown, 
        { onCancel }: { onCancel: () => R },
        { getState, setState }: GetSetState<FormData>
    ) {

        const {
            dob, lname, fname, sex, lenses
        } = getState({
            dob: undefined,
            fname: undefined,
            lname: undefined,
            sex: undefined
        })

        yield onCreated(() => [setDoFlush(false)])
        yield onRemoved(() => [setDoFlush(true)])

        yield message([
            `Имя: ${fname ?? '?'}`,
            `Фамилия: ${lname ?? '?'}`,
            `sex: ${sex ?? '?'}`,
        ])

        const set = <S>(f: (s: S) => (s: FormData) => FormData) => action(flow(f, setState))

        if (!fname) {
            yield inputHandler([
                on(withText, set(lenses.fname.set))
            ])
            yield message('Ваше имя: ')
        }
        else if (!lname) {
            yield inputHandler([
                on(withText, set(lenses.lname.set))
            ])
            yield message('Фамилия: ')
        }
        else if (!sex) {
            yield radioRow(['Муж', 'Жен'], (idx) => setState(lenses.sex.set(
                ['male', 'female'][idx] as 'male' | 'female'
            )), sex == 'male' ? 'Муж' : 'Жен')
        }
        else {
            yield button('done', onCancel)
        }
    }
)