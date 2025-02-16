import PropTypes from "prop-types";
import Number from "./Number";
import { useContext } from "react";
import { SocketContext } from "../context/SocketContext";

const Block = ({
  number,
  handleClick,
  selection,
  index,
  CORRECT_ANSWER_LIST,
}) => {
  const { board } = useContext(SocketContext);
  const diag1Success = CORRECT_ANSWER_LIST.diagonal1.every(
    (item, _, list) => list.includes(index + 1) && selection[board[item - 1]]
  );
  const diag2Success = CORRECT_ANSWER_LIST.diagonal2.every(
    (item, _, list) => list.includes(index + 1) && selection[board[item - 1]]
  );

  const horizontalSuccess = CORRECT_ANSWER_LIST?.horizontal
    ?.find((list) => list.includes(index + 1))
    ?.every((item) => selection[board[item - 1]]);

  const verticalSuccess = CORRECT_ANSWER_LIST?.vertical
    ?.find((list) => list.includes(index + 1))
    ?.every((item) => selection[board[item - 1]]);

  let showDiagonal1 = true;
  let showDiagonal2 = true;

  if (verticalSuccess || horizontalSuccess) {
    showDiagonal1 = false;
    showDiagonal2 = false;
  }

  if (diag1Success) {
    showDiagonal1 = true;
    showDiagonal2 = false;
  }

  if (diag2Success) {
    showDiagonal2 = true;
    showDiagonal1 = false;
  }

  if (diag1Success && diag2Success) {
    showDiagonal1 = true;
    showDiagonal2 = true;
  }

  return (
    <button
      onClick={handleClick}
      className={`relative w-full h-full aspect-square flex justify-center items-center transition-colors ${
        selection[number] ? "bg-green-400" : "bg-violet-400"
      } ${selection[number] ? "hover:bg-green-400" : "hover:bg-violet-500"}`}
      style={{ cursor: selection[number] ? "default" : "pointer" }}
      type="button"
    >
      {selection[number] && (
        <>
          {verticalSuccess && (
            <div className="absolute bg-red-500 h-[120%] w-1"></div>
          )}
          {horizontalSuccess && (
            <div className="absolute bg-red-500 h-1 w-[120%]"></div>
          )}

          {showDiagonal1 && (
            <div
              className={`absolute bg-red-500 h-1 rotate-45 ${
                diag1Success ? "w-[170%]" : "w-[80%]"
              }`}
            ></div>
          )}

          {showDiagonal2 && (
            <div
              className={`absolute bg-red-500 h-1 rotate-[-45deg] ${
                diag2Success ? "w-[170%]" : "w-[80%]"
              }`}
            ></div>
          )}
        </>
      )}

      <Number number={number} />
    </button>
  );
};

export default Block;

Block.propTypes = {
  number: PropTypes.number.isRequired,
  handleClick: PropTypes.func.isRequired,
  selection: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  CORRECT_ANSWER_LIST: PropTypes.object.isRequired,
};
