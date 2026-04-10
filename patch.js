const fs = require('fs');

function patchFile(file) {
    const p = 'c:/Users/Awaji-iyaham Atteng/Desktop/ExamPrep/src/components/questions/renderers/' + file;
    let c = fs.readFileSync(p, 'utf8');
    
    // Add isPlayingRef
    if (!c.includes('isPlayingRef')) {
        c = c.replace(/const \[flowState, setFlowState\] = useState<FlowState>([^;]+);/, 'const [flowState, setFlowState] = useState<FlowState>$1;\n    const isPlayingRef = useRef(false);');
    }
    
    // Guard handleStartFlow
    if (c.includes('const handleStartFlow = () => {')) {
         c = c.replace(/const handleStartFlow = \(\) => \{\s+setFlowState\('playing'\);/, 'const handleStartFlow = () => {\n        if (isPlayingRef.current) return;\n        isPlayingRef.current = true;\n        setFlowState(\'playing\');');
    }

    // Un-guard inside useEffect
    if (!c.includes('!isPlayingRef.current')) {
         c = c.replace(/if \(!reviewMode\) \{\s*handleStartFlow\(\);\s*\}/, 'if (!reviewMode && !isPlayingRef.current) {\n            handleStartFlow();\n        }');
    }

    // Reset inside clear/teardown
    if (c.includes('return () => {') && !c.includes('isPlayingRef.current = false;')) {
         c = c.replace(/stopSpeaking\(\);/g, 'stopSpeaking();\n            isPlayingRef.current = false;');
    }
    
    fs.writeFileSync(p, c);
}

patchFile('ListenRepeat.tsx');
patchFile('TakeInterview.tsx');
