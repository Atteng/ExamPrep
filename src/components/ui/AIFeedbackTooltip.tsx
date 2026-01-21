import { useState } from 'react';
import { Info } from 'lucide-react';

interface AIFeedbackTooltipProps {
    feedback: string;
}

export function AIFeedbackTooltip({ feedback }: AIFeedbackTooltipProps) {
    const [show, setShow] = useState(false);

    if (!feedback) return null;

    return (
        <div className="relative inline-block">
            <button
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                onClick={() => setShow(!show)}
                className="ml-2 text-blue-500 hover:text-blue-700 transition-colors"
                type="button"
            >
                <Info className="w-4 h-4" />
            </button>

            {show && (
                <div className="absolute z-50 left-0 top-6 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl">
                    <div className="font-semibold mb-1">AI Feedback</div>
                    <div className="text-gray-200">{feedback}</div>
                    <div className="absolute -top-2 left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-900"></div>
                </div>
            )}
        </div>
    );
}
