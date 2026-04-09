import svgPaths from "./svg-lcfdbebd6c";

function Tab() {
  return (
    <div className="bg-[#2b7fff] flex-[80.891_0_0] h-[25px] min-h-px min-w-px relative rounded-[6px]" data-name="Tab">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[9px] py-[5px] relative size-full">
          <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[12px] text-center text-white whitespace-nowrap">Dashboard</p>
        </div>
      </div>
    </div>
  );
}

function Tab1() {
  return (
    <div className="flex-[87.422_0_0] h-[25px] min-h-px min-w-px relative rounded-[6px]" data-name="Tab">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[9px] py-[5px] relative size-full">
          <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#0a0a0a] text-[12px] text-center whitespace-nowrap">Distribuição</p>
        </div>
      </div>
    </div>
  );
}

function Tab2() {
  return (
    <div className="flex-[90.297_0_0] h-[25px] min-h-px min-w-px relative rounded-[6px]" data-name="Tab">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[9px] py-[5px] relative size-full">
          <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#0a0a0a] text-[12px] text-center whitespace-nowrap">Visualização</p>
        </div>
      </div>
    </div>
  );
}

function TabList() {
  return (
    <div className="bg-white content-stretch flex h-[36px] items-center justify-center px-[5px] py-px relative rounded-[6px] shrink-0 w-[268.609px]" data-name="Tab List">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <Tab />
      <Tab1 />
      <Tab2 />
    </div>
  );
}

function Icon() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon">
          <path d={svgPaths.p2ebe2e00} id="Vector" stroke="var(--stroke-0, #009689)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d="M7 12.8333V7" id="Vector_2" stroke="var(--stroke-0, #009689)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p21a6a770} id="Vector_3" stroke="var(--stroke-0, #009689)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d="M4.375 2.49083L9.625 5.495" id="Vector_4" stroke="var(--stroke-0, #009689)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
      </svg>
    </div>
  );
}

function Container1() {
  return (
    <div className="bg-[#cbfbf1] relative rounded-[6px] shrink-0 size-[28px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[7px] relative size-full">
        <Icon />
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[13.5px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[13.5px] left-0 not-italic text-[#6a7282] text-[9px] top-0 tracking-[0.167px] uppercase whitespace-nowrap">Peças/Hora</p>
    </div>
  );
}

function Container4() {
  return (
    <div className="h-[28px] overflow-clip relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-0 not-italic text-[#101828] text-[18px] top-0 tracking-[-0.4395px] whitespace-nowrap">11.09</p>
    </div>
  );
}

function Container2() {
  return (
    <div className="h-[41.5px] relative shrink-0 w-[60.25px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Container3 />
        <Container4 />
      </div>
    </div>
  );
}

function ResumoResultados1() {
  return (
    <div className="h-[41.5px] relative shrink-0" data-name="ResumoResultados">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
        <Container1 />
        <Container2 />
      </div>
    </div>
  );
}

function Card() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative rounded-[6px]" data-name="Card">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col items-start justify-center p-[7px] relative w-full">
          <ResumoResultados1 />
        </div>
      </div>
    </div>
  );
}

function Icon1() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g clipPath="url(#clip0_266_1141)" id="Icon">
          <path d={svgPaths.pc012c00} id="Vector" stroke="var(--stroke-0, #155DFC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d="M7 3.5V7L9.33333 8.16667" id="Vector_2" stroke="var(--stroke-0, #155DFC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
        <defs>
          <clipPath id="clip0_266_1141">
            <rect fill="white" height="14" width="14" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container5() {
  return (
    <div className="bg-[#dbeafe] relative rounded-[6px] shrink-0 size-[28px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[7px] relative size-full">
        <Icon1 />
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0 w-full" data-name="Container">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[13.5px] not-italic relative shrink-0 text-[#6a7282] text-[9px] tracking-[0.167px] uppercase whitespace-nowrap">Takt Time</p>
    </div>
  );
}

function Container8() {
  return (
    <div className="content-stretch flex items-center justify-center overflow-clip relative shrink-0 w-full" data-name="Container">
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[0] not-italic relative shrink-0 text-[#101828] text-[0px] tracking-[-0.4395px] whitespace-nowrap">
        <span className="leading-[28px] text-[18px]">5.41</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[15.556px] text-[#6a7282] text-[10px] tracking-[0.1172px]">min</span>
      </p>
    </div>
  );
}

function Container6() {
  return (
    <div className="relative shrink-0 w-[53px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <Container7 />
        <Container8 />
      </div>
    </div>
  );
}

function ResumoResultados2() {
  return (
    <div className="h-[41.5px] relative shrink-0" data-name="ResumoResultados">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
        <Container5 />
        <Container6 />
      </div>
    </div>
  );
}

function Card1() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative rounded-[6px]" data-name="Card">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col items-start justify-center p-[7px] relative w-full">
          <ResumoResultados2 />
        </div>
      </div>
    </div>
  );
}

function Icon2() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon">
          <path d="M5.83333 1.16667H8.16667" id="Vector" stroke="var(--stroke-0, #9810FA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d="M7 8.16667L8.75 6.41667" id="Vector_2" stroke="var(--stroke-0, #9810FA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p3c1f7100} id="Vector_3" stroke="var(--stroke-0, #9810FA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
      </svg>
    </div>
  );
}

function Container9() {
  return (
    <div className="bg-[#f3e8ff] relative rounded-[6px] shrink-0 size-[28px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[7px] relative size-full">
        <Icon2 />
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0" data-name="Container">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[13.5px] not-italic relative shrink-0 text-[#6a7282] text-[9px] tracking-[0.167px] uppercase whitespace-nowrap">Tempo Ciclo</p>
    </div>
  );
}

function Container12() {
  return (
    <div className="content-stretch flex items-center justify-center overflow-clip relative shrink-0" data-name="Container">
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[0] not-italic relative shrink-0 text-[#101828] text-[0px] tracking-[-0.4395px] whitespace-nowrap">
        <span className="leading-[28px] text-[18px]">5.41</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[15.556px] text-[#6a7282] text-[10px] tracking-[0.1172px]">min</span>
      </p>
    </div>
  );
}

function Container10() {
  return (
    <div className="relative shrink-0 w-[63.844px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <Container11 />
        <Container12 />
      </div>
    </div>
  );
}

function ResumoResultados3() {
  return (
    <div className="h-[41.5px] relative shrink-0" data-name="ResumoResultados">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
        <Container9 />
        <Container10 />
      </div>
    </div>
  );
}

function Card2() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative rounded-[6px]" data-name="Card">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col items-start justify-center p-[7px] relative w-full">
          <ResumoResultados3 />
        </div>
      </div>
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon">
          <path d={svgPaths.p1977ee80} id="Vector" stroke="var(--stroke-0, #00A63E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p3471a100} id="Vector_2" stroke="var(--stroke-0, #00A63E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
      </svg>
    </div>
  );
}

function Container13() {
  return (
    <div className="bg-[#dcfce7] relative rounded-[6px] shrink-0 size-[28px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[7px] relative size-full">
        <Icon3 />
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0" data-name="Container">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[13.5px] not-italic relative shrink-0 text-[#6a7282] text-[9px] tracking-[0.167px] uppercase whitespace-nowrap">Produtividade</p>
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex items-center justify-center overflow-clip relative shrink-0" data-name="Container">
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[28px] not-italic relative shrink-0 text-[#101828] text-[18px] tracking-[-0.4395px] whitespace-nowrap">66.1%</p>
    </div>
  );
}

function Container14() {
  return (
    <div className="relative shrink-0 w-[76px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <Container15 />
        <Container16 />
      </div>
    </div>
  );
}

function ResumoResultados4() {
  return (
    <div className="relative shrink-0" data-name="ResumoResultados">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] items-center relative">
        <Container13 />
        <Container14 />
      </div>
    </div>
  );
}

function Card3() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative rounded-[6px]" data-name="Card">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col items-start justify-center p-[7px] relative w-full">
          <ResumoResultados4 />
        </div>
      </div>
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon">
          <path d={svgPaths.p3ba1200} id="Vector" stroke="var(--stroke-0, #E17100)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d="M7 5.25V7.58333" id="Vector_2" stroke="var(--stroke-0, #E17100)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d="M7 9.91667H7.00583" id="Vector_3" stroke="var(--stroke-0, #E17100)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
      </svg>
    </div>
  );
}

function Container17() {
  return (
    <div className="bg-[#fef3c6] relative rounded-[6px] shrink-0 size-[28px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[7px] relative size-full">
        <Icon4 />
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0" data-name="Container">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[13.5px] not-italic relative shrink-0 text-[#6a7282] text-[9px] tracking-[0.167px] uppercase whitespace-nowrap">Perdas</p>
    </div>
  );
}

function Container20() {
  return (
    <div className="content-stretch flex items-center justify-center overflow-clip relative shrink-0" data-name="Container">
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[28px] not-italic relative shrink-0 text-[#101828] text-[18px] tracking-[-0.4395px] whitespace-nowrap">33.9%</p>
    </div>
  );
}

function Container18() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
        <Container19 />
        <Container20 />
      </div>
    </div>
  );
}

function ResumoResultados5() {
  return (
    <div className="h-[41.5px] relative shrink-0" data-name="ResumoResultados">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
        <Container17 />
        <Container18 />
      </div>
    </div>
  );
}

function Card4() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative rounded-[6px]" data-name="Card">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col items-start justify-center p-[7px] relative w-full">
          <ResumoResultados5 />
        </div>
      </div>
    </div>
  );
}

function Icon5() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g id="Icon">
          <path d={svgPaths.p317fdd80} id="Vector" stroke="var(--stroke-0, #4F39F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p31c78b80} id="Vector_2" stroke="var(--stroke-0, #4F39F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p3625bb80} id="Vector_3" stroke="var(--stroke-0, #4F39F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p2ca18b80} id="Vector_4" stroke="var(--stroke-0, #4F39F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
      </svg>
    </div>
  );
}

function Container21() {
  return (
    <div className="bg-[#e0e7ff] relative rounded-[6px] shrink-0 size-[28px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-[7px] relative size-full">
        <Icon5 />
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="content-stretch flex items-center justify-center relative shrink-0" data-name="Container">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[13.5px] not-italic relative shrink-0 text-[#6a7282] text-[9px] tracking-[0.167px] uppercase whitespace-nowrap">Operadores</p>
    </div>
  );
}

function Container24() {
  return (
    <div className="content-stretch flex items-center justify-center overflow-clip relative shrink-0" data-name="Container">
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[28px] not-italic relative shrink-0 text-[#101828] text-[18px] tracking-[-0.4395px] whitespace-nowrap">8</p>
    </div>
  );
}

function Container22() {
  return (
    <div className="relative shrink-0 w-[63.063px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <Container23 />
        <Container24 />
      </div>
    </div>
  );
}

function ResumoResultados6() {
  return (
    <div className="h-[41.5px] relative shrink-0" data-name="ResumoResultados">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[6px] h-full items-center relative">
        <Container21 />
        <Container22 />
      </div>
    </div>
  );
}

function Card5() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative rounded-[6px]" data-name="Card">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <div className="flex flex-col justify-center size-full">
        <div className="content-stretch flex flex-col items-start justify-center p-[7px] relative w-full">
          <ResumoResultados6 />
        </div>
      </div>
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[8px] items-center min-h-px min-w-px relative">
      <Card />
      <Card1 />
      <Card2 />
      <Card3 />
      <Card4 />
      <Card5 />
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex gap-[16px] items-end relative shrink-0 w-full" data-name="Container">
      <TabList />
      <Frame />
    </div>
  );
}

export default function ResumoResultados() {
  return (
    <div className="bg-[#f9fafb] content-stretch flex flex-col gap-[12px] items-start relative size-full" data-name="ResumoResultados">
      <Container />
    </div>
  );
}