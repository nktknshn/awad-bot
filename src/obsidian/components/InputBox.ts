import { connected0 } from "Lib/component";
import { button } from "Lib/elements-constructors";
import { action, caseText, on } from "Lib/input";
import { inputHandler, message } from 'Lib/lib';
import { InputHandlerData } from "Lib/textmessage";

export const InputBox = connected0(function* InputBox<R1, R2, R3>({
    title, onCancel, onSuccess, onWrongInput, cancelTitle = 'Cancel' }: {
        title: string;
        cancelTitle?: string;
        onCancel: () => R1;
        onSuccess: (text: string) => R2;
        onWrongInput: (ctx: InputHandlerData) => R3;
    }) {

    yield inputHandler([
        on(caseText, action(({ messageText }) => onSuccess(messageText))),
    ]);

    yield message(title);

    yield button(cancelTitle, () => onCancel());
});
